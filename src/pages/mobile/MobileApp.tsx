import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuthStore, useJobStore, useSOStore, useTechStore, useUIStore } from '@/store';
import { APP_LANGUAGE_LABELS, type AppLanguage } from '@/lib/app-language';
import { cn, SERVICE_TYPE_LABELS, formatFileSize, parseDateValue, toISODate } from '@/lib/utils';
import type { Attachment, Job, JobNote, JobStatus, SalesOrder, SOLine, Technician } from '@/types';

type MobileTab = 'home' | 'jobs' | 'profile';
type MobileJobTab = 'overview' | 'journal' | 'sales' | 'closeout';
type MobileJobFilter = 'active' | 'today' | 'upcoming' | 'completed';
type PaymentMethod = 'CASH' | 'CARD' | 'CHEQUE' | 'OTHER';

type PaymentCapture = {
  paid: boolean;
  method?: PaymentMethod;
  note?: string;
  recordedAt: string;
  recordedBy: string;
};

type JournalGroup = {
  createdAt: string;
  notes: JobNote[];
  attachments: Attachment[];
};

type ApprovedCatalogItem = {
  id: string;
  label: string;
  description: string;
  rate: number;
  category: 'SERVICE' | 'INVENTORY';
};

const CLOSED_JOB_STATUSES: JobStatus[] = ['COMPLETED', 'BILLING_READY', 'INVOICED'];
const ACTIVE_JOB_STATUSES: JobStatus[] = ['SCHEDULED', 'DISPATCHED', 'EN_ROUTE', 'IN_PROGRESS', 'READY_FOR_SIGNATURE', 'ON_HOLD'];
const PAYMENT_NOTE_PREFIX = '__FSM_PAYMENT__';
const MAX_ATTACHMENT_SIZE_BYTES = 8 * 1024 * 1024;

const APPROVED_ITEM_CATALOG: ApprovedCatalogItem[] = [
  { id: 'svc-diagnostics', label: 'Diagnostic Visit', description: 'Approved onsite diagnostic service', rate: 165, category: 'SERVICE' },
  { id: 'svc-emergency', label: 'Emergency Response', description: 'After-hours service response', rate: 225, category: 'SERVICE' },
  { id: 'inv-filter-kit', label: 'Filter Kit', description: 'Approved consumable filter kit', rate: 48, category: 'INVENTORY' },
  { id: 'inv-thermostat', label: 'Programmable Thermostat', description: 'Approved thermostat replacement', rate: 129, category: 'INVENTORY' },
  { id: 'inv-valve-pack', label: 'Valve Service Pack', description: 'Approved valve repair pack', rate: 86, category: 'INVENTORY' },
];

const MOBILE_COPY = {
  en: {
    tabs: { home: 'Home', jobs: 'Jobs', profile: 'Profile' },
    greetingMorning: 'Good morning',
    greetingAfternoon: 'Good afternoon',
    commandCenter: 'Technician workspace',
    todayQueue: "Today's queue",
    activeNow: 'Active now',
    noActiveJob: 'No active job right now.',
    noTodayJobs: 'No jobs scheduled for today.',
    noVisibleJobs: 'No assigned jobs match this view.',
    upcoming: 'Upcoming',
    completedToday: 'Completed today',
    assigned: 'Assigned',
    openJob: 'Open job',
    navigate: 'Navigate',
    directions: 'Directions',
    profileTitle: 'Profile',
    technicianMode: 'Execution-only mode',
    syncNow: 'Sync now',
    syncing: 'Saving...',
    lastSaved: 'Last saved',
    pendingChanges: 'Pending changes',
    signOut: 'Sign out',
    filters: {
      active: 'Active',
      today: 'Today',
      upcoming: 'Upcoming',
      completed: 'Done today',
    },
    sections: {
      summary: 'Summary',
      dispatcherNotes: 'Dispatcher notes',
      fieldJournal: 'Field journal',
      salesOrder: 'Linked sales order',
      closeout: 'Closeout',
      report: 'Work report',
      payment: 'Payment capture',
      signatures: 'Signatures',
      customerSignature: 'Customer signature',
      techSignature: 'Technician sign-off',
      approvedItems: 'Approved items',
      lineItems: 'Current lines',
      requirements: 'Completion requirements',
    },
    labels: {
      jobNumber: 'Job',
      customer: 'Customer',
      contact: 'Contact',
      phone: 'Phone',
      email: 'Email',
      address: 'Address',
      language: 'Language',
      serviceType: 'Service type',
      priority: 'Priority',
      scheduled: 'Scheduled',
      dispatcher: 'Dispatcher',
      catalog: 'Catalog',
      total: 'Total',
      balance: 'Balance',
      reportPlaceholder: 'Describe the work completed, findings, and any follow-up needed.',
      journalPlaceholder: 'Add a field note for the office, customer context, or onsite findings.',
      paymentMethod: 'Payment method',
      paymentNote: 'Payment note',
      qty: 'Qty',
      note: 'Note',
      rate: 'Rate',
    },
    buttons: {
      saveReport: 'Save report',
      savePayment: 'Save payment',
      saveJournal: 'Save note',
      addFromCamera: 'Camera',
      addFiles: 'Files',
      clear: 'Clear',
      addLine: 'Add approved line',
      startJob: 'Start job',
      moveInProgress: 'In progress',
      readyForSignature: 'Ready for signature',
      completeJob: 'Complete',
      back: 'Back',
    },
    payment: {
      unknown: 'Not recorded',
      no: 'No payment collected',
      yes: 'Payment collected',
      saved: 'Payment saved to the audit trail.',
    },
    statusIntro: 'Technicians execute. The system controls. Data is always saved.',
    reportRequired: 'A work report is required before completion.',
    signatureRequired: 'A customer signature is required before completion.',
    lineAdded: 'Approved item added to the linked sales order.',
    lineRestricted: 'Only approved catalog items can be added here.',
    salesEmpty: 'No linked sales order is available for this job.',
    salesRestricted: 'Technicians can only add approved items to the existing linked order.',
    journalEmpty: 'No field notes or attachments have been saved yet.',
    attachmentsReady: 'Selected attachments',
    mobilePreview: 'Technician mobile preview',
    readyForSignatureNote: 'Job marked ready for customer signature.',
    reportSaved: 'Work report saved.',
    signatureSaved: 'Signature saved.',
    jobCompleted: 'Job completed successfully.',
    cannotComplete: 'Complete the report and customer signature before finishing the job.',
    reportSavedLabel: 'Report on file',
    signatureSavedLabel: 'Customer signature on file',
    lineNotePlaceholder: 'Optional note for the office',
    auditLocked: 'Saved history is read-only for technicians.',
    hiddenHistory: 'Completed jobs before today stay out of the mobile queue.',
    noSalesLink: 'Sales order access is only available inside an assigned job.',
    pending: 'Pending',
    journalSaved: 'Field entry saved.',
    choosePaymentState: 'Choose whether payment was collected before saving.',
    openAttachment: 'Open',
    fileTooLarge: 'One or more files were skipped because they are too large for mobile sync.',
    reportUnlocksSignature: 'Save or write the work report before moving to signature.',
  },
  fr: {
    tabs: { home: 'Accueil', jobs: 'Travaux', profile: 'Profil' },
    greetingMorning: 'Bonjour',
    greetingAfternoon: 'Bon après-midi',
    commandCenter: 'Espace technicien',
    todayQueue: "File d'aujourd'hui",
    activeNow: 'En cours',
    noActiveJob: "Aucun travail actif pour le moment.",
    noTodayJobs: "Aucun travail prévu aujourd'hui.",
    noVisibleJobs: "Aucun travail assigné ne correspond à cette vue.",
    upcoming: 'À venir',
    completedToday: "Terminés aujourd'hui",
    assigned: 'Assignés',
    openJob: 'Ouvrir',
    navigate: 'Naviguer',
    directions: 'Itinéraire',
    profileTitle: 'Profil',
    technicianMode: "Mode exécution seulement",
    syncNow: 'Synchroniser',
    syncing: 'Enregistrement...',
    lastSaved: 'Dernière sauvegarde',
    pendingChanges: 'Modifications en attente',
    signOut: 'Fermer la session',
    filters: {
      active: 'Actifs',
      today: "Aujourd'hui",
      upcoming: 'À venir',
      completed: "Terminés aujourd'hui",
    },
    sections: {
      summary: 'Résumé',
      dispatcherNotes: 'Notes du bureau',
      fieldJournal: 'Journal terrain',
      salesOrder: 'Commande liée',
      closeout: 'Clôture',
      report: 'Rapport de travail',
      payment: 'Capture de paiement',
      signatures: 'Signatures',
      customerSignature: 'Signature du client',
      techSignature: 'Signature du technicien',
      approvedItems: 'Articles approuvés',
      lineItems: 'Lignes actuelles',
      requirements: 'Conditions de clôture',
    },
    labels: {
      jobNumber: 'Travail',
      customer: 'Client',
      contact: 'Contact',
      phone: 'Téléphone',
      email: 'Courriel',
      address: 'Adresse',
      language: 'Langue',
      serviceType: 'Type de service',
      priority: 'Priorité',
      scheduled: 'Planifié',
      dispatcher: 'Bureau',
      catalog: 'Catalogue',
      total: 'Total',
      balance: 'Solde',
      reportPlaceholder: 'Décrivez le travail effectué, les constats et le suivi requis.',
      journalPlaceholder: 'Ajoutez une note terrain pour le bureau ou le contexte client.',
      paymentMethod: 'Mode de paiement',
      paymentNote: 'Note de paiement',
      qty: 'Qt',
      note: 'Note',
      rate: 'Tarif',
    },
    buttons: {
      saveReport: 'Enregistrer le rapport',
      savePayment: 'Enregistrer le paiement',
      saveJournal: 'Enregistrer la note',
      addFromCamera: 'Caméra',
      addFiles: 'Fichiers',
      clear: 'Effacer',
      addLine: 'Ajouter une ligne approuvée',
      startJob: 'Débuter',
      moveInProgress: 'En exécution',
      readyForSignature: 'Prêt pour signature',
      completeJob: 'Terminer',
      back: 'Retour',
    },
    payment: {
      unknown: 'Non enregistré',
      no: 'Aucun paiement collecté',
      yes: 'Paiement collecté',
      saved: 'Paiement enregistré dans la piste de vérification.',
    },
    statusIntro: 'Les techniciens exécutent. Le système contrôle. Les données sont toujours sauvegardées.',
    reportRequired: 'Un rapport de travail est obligatoire avant la clôture.',
    signatureRequired: 'Une signature client est obligatoire avant la clôture.',
    lineAdded: 'Article approuvé ajouté à la commande liée.',
    lineRestricted: 'Seuls les articles approuvés peuvent être ajoutés ici.',
    salesEmpty: "Aucune commande liée n'est disponible pour ce travail.",
    salesRestricted: "Les techniciens peuvent seulement ajouter des articles approuvés à la commande déjà liée.",
    journalEmpty: "Aucune note terrain ni pièce jointe n'a encore été sauvegardée.",
    attachmentsReady: 'Pièces sélectionnées',
    mobilePreview: 'Aperçu mobile technicien',
    readyForSignatureNote: 'Le travail est prêt pour la signature du client.',
    reportSaved: 'Rapport enregistré.',
    signatureSaved: 'Signature enregistrée.',
    jobCompleted: 'Travail terminé avec succès.',
    cannotComplete: 'Le rapport et la signature du client sont obligatoires avant la fin du travail.',
    reportSavedLabel: 'Rapport enregistré',
    signatureSavedLabel: 'Signature client enregistrée',
    lineNotePlaceholder: 'Note optionnelle pour le bureau',
    auditLocked: "L'historique enregistré est en lecture seule pour les techniciens.",
    hiddenHistory: "Les travaux terminés avant aujourd'hui restent hors de la file mobile.",
    noSalesLink: "L'accès commande est disponible seulement dans un travail assigné.",
    pending: 'En attente',
    journalSaved: 'Entrée terrain enregistrée.',
    choosePaymentState: 'Choisissez si un paiement a été collecté avant de sauvegarder.',
    openAttachment: 'Ouvrir',
    fileTooLarge: 'Un ou plusieurs fichiers ont été ignorés parce qu’ils sont trop lourds pour la synchronisation mobile.',
    reportUnlocksSignature: 'Rédigez ou enregistrez le rapport avant de passer à la signature.',
  },
} as const;

const PAYMENT_METHOD_LABELS: Record<AppLanguage, Record<PaymentMethod, string>> = {
  en: { CASH: 'Cash', CARD: 'Card', CHEQUE: 'Cheque', OTHER: 'Other' },
  fr: { CASH: 'Comptant', CARD: 'Carte', CHEQUE: 'Cheque', OTHER: 'Autre' },
};

const STATUS_LABELS_BY_LANGUAGE: Record<AppLanguage, Record<JobStatus, string>> = {
  en: {
    NEW: 'New',
    SCHEDULED: 'Scheduled',
    DISPATCHED: 'Dispatched',
    EN_ROUTE: 'En route',
    IN_PROGRESS: 'In progress',
    READY_FOR_SIGNATURE: 'Ready for signature',
    ON_HOLD: 'On hold',
    COMPLETED: 'Completed',
    CANCELLED: 'Cancelled',
    BILLING_READY: 'Billing ready',
    INVOICED: 'Invoiced',
  },
  fr: {
    NEW: 'Nouveau',
    SCHEDULED: 'Planifié',
    DISPATCHED: 'Réparti',
    EN_ROUTE: 'En route',
    IN_PROGRESS: 'En exécution',
    READY_FOR_SIGNATURE: 'Prêt pour signature',
    ON_HOLD: 'En attente',
    COMPLETED: 'Terminé',
    CANCELLED: 'Annulé',
    BILLING_READY: 'Prêt pour facturation',
    INVOICED: 'Facturé',
  },
};

const PRIORITY_LABELS_BY_LANGUAGE: Record<AppLanguage, Record<Job['priority'], string>> = {
  en: { CRITICAL: 'Critical', HIGH: 'High', MEDIUM: 'Medium', LOW: 'Low' },
  fr: { CRITICAL: 'Critique', HIGH: 'Haute', MEDIUM: 'Moyenne', LOW: 'Basse' },
};

const SERVICE_TYPE_LABELS_BY_LANGUAGE: Record<AppLanguage, Partial<Record<Job['serviceType'], string>>> = {
  en: {},
  fr: {
    INSTALLATION: 'Installation',
    REPAIR: 'Réparation',
    MAINTENANCE: 'Entretien',
    INSPECTION: 'Inspection',
    WARRANTY_REPAIR: 'Réparation sous garantie',
    EMERGENCY: 'Urgence',
    PREVENTIVE_MAINTENANCE: 'Entretien préventif',
    DECOMMISSION: 'Retrait',
  },
};

type MobileIconProps = { className?: string };

const HomeIcon: React.FC<MobileIconProps> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
    <path d="M3.75 10.5 12 4l8.25 6.5" />
    <path d="M6.75 9.75v9h10.5v-9" />
  </svg>
);

const JobIcon: React.FC<MobileIconProps> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
    <rect x="5" y="4.5" width="14" height="15" rx="2.5" />
    <path d="M8.5 8.5h7M8.5 12h7M8.5 15.5h4.5" />
  </svg>
);

const ProfileIcon: React.FC<MobileIconProps> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
    <circle cx="12" cy="8.25" r="3.25" />
    <path d="M5.5 19c1.45-3.1 4.08-4.65 6.5-4.65S17.05 15.9 18.5 19" />
  </svg>
);

const BackIcon: React.FC<MobileIconProps> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
    <path d="m15 18-6-6 6-6" />
  </svg>
);

const CameraIcon: React.FC<MobileIconProps> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
    <path d="M4.5 8.5h15a1.5 1.5 0 0 1 1.5 1.5v7.5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V10A1.5 1.5 0 0 1 4.5 8.5Z" />
    <path d="m9 8.5 1.15-2h3.7L15 8.5" />
    <circle cx="12" cy="13.25" r="3.1" />
  </svg>
);

const AttachmentIcon: React.FC<MobileIconProps> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
    <path d="m13.75 6.25-5.8 5.8a3.25 3.25 0 1 0 4.6 4.6l6.15-6.15a5.25 5.25 0 1 0-7.43-7.43L4.9 9.44" />
  </svg>
);

const NAV_ITEMS: Array<{ id: MobileTab; icon: React.FC<MobileIconProps> }> = [
  { id: 'home', icon: HomeIcon },
  { id: 'jobs', icon: JobIcon },
  { id: 'profile', icon: ProfileIcon },
];

function isMobileTab(value: string | null): value is MobileTab {
  return value === 'home' || value === 'jobs' || value === 'profile';
}

function isMobileJobTab(value: string | null): value is MobileJobTab {
  return value === 'overview' || value === 'journal' || value === 'sales' || value === 'closeout';
}

function getPreviewTechnicianId(
  user: { workspace: 'SERVICE' | 'INSTALLATION'; technicianId?: string } | null,
  technicians: Technician[],
) {
  if (user?.technicianId) return user.technicianId;

  const category = user?.workspace === 'INSTALLATION' ? 'INSTALLATION' : 'SERVICE';
  return technicians.find((technician) => technician.category === category)?.id || technicians[0]?.id;
}

function isHistoricalCompletedJob(job: Job, today: string) {
  if (!CLOSED_JOB_STATUSES.includes(job.status)) {
    return false;
  }

  const completedDate = job.actualEnd ? toISODate(new Date(job.actualEnd)) : job.scheduledDate;
  return Boolean(completedDate && completedDate < today);
}

function getVisibleTechnicianJobs(jobs: Job[], technicianId?: string) {
  const today = toISODate(new Date());

  return jobs
    .filter((job) => job.technicianId === technicianId)
    .filter((job) => job.status !== 'CANCELLED')
    .filter((job) => !isHistoricalCompletedJob(job, today))
    .sort((left, right) => {
      const leftRank = ACTIVE_JOB_STATUSES.includes(left.status) ? 0 : CLOSED_JOB_STATUSES.includes(left.status) ? 3 : 1;
      const rightRank = ACTIVE_JOB_STATUSES.includes(right.status) ? 0 : CLOSED_JOB_STATUSES.includes(right.status) ? 3 : 1;

      if (leftRank !== rightRank) {
        return leftRank - rightRank;
      }

      const leftDate = left.scheduledDate || '9999-12-31';
      const rightDate = right.scheduledDate || '9999-12-31';
      if (leftDate !== rightDate) {
        return leftDate.localeCompare(rightDate);
      }

      return (left.scheduledStart || '').localeCompare(right.scheduledStart || '');
    });
}

function getLocalizedStatus(language: AppLanguage, status: JobStatus) {
  return STATUS_LABELS_BY_LANGUAGE[language][status] || status;
}

function getLocalizedServiceType(language: AppLanguage, serviceType: Job['serviceType']) {
  return SERVICE_TYPE_LABELS_BY_LANGUAGE[language][serviceType] || SERVICE_TYPE_LABELS[serviceType] || serviceType;
}

function getLocale(language: AppLanguage) {
  return language === 'fr' ? 'fr-CA' : 'en-US';
}

function formatDateForLanguage(language: AppLanguage, value?: string) {
  if (!value) return '—';
  const parsed = parseDateValue(value);
  if (!parsed) return value;
  return new Intl.DateTimeFormat(getLocale(language), { month: 'short', day: 'numeric', year: 'numeric' }).format(parsed);
}

function formatShortDateForLanguage(language: AppLanguage, value?: string) {
  if (!value) return '—';
  const parsed = parseDateValue(value);
  if (!parsed) return value;
  return new Intl.DateTimeFormat(getLocale(language), { month: 'short', day: 'numeric' }).format(parsed);
}

function formatDateTimeForLanguage(language: AppLanguage, value?: string) {
  if (!value) return '—';
  const parsed = parseDateValue(value);
  if (!parsed) return value;
  return new Intl.DateTimeFormat(getLocale(language), {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(parsed);
}

function formatCurrencyForLanguage(language: AppLanguage, amount: number) {
  return new Intl.NumberFormat(getLocale(language), {
    style: 'currency',
    currency: 'USD',
  }).format(amount || 0);
}

function getAddressLine(job: Job) {
  return [
    job.serviceAddress.street,
    job.serviceAddress.city,
    job.serviceAddress.state,
    job.serviceAddress.zip,
  ].filter(Boolean).join(', ');
}

function getMapsLink(job: Job) {
  const query = encodeURIComponent(getAddressLine(job) || job.customerName);
  if (typeof navigator !== 'undefined' && /iPad|iPhone|iPod|Mac/i.test(navigator.userAgent)) {
    return `https://maps.apple.com/?q=${query}`;
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${query}`;
}

function encodePaymentCapture(capture: PaymentCapture) {
  return `${PAYMENT_NOTE_PREFIX}${JSON.stringify(capture)}`;
}

function decodePaymentCapture(text: string): PaymentCapture | null {
  if (!text.startsWith(PAYMENT_NOTE_PREFIX)) {
    return null;
  }

  try {
    return JSON.parse(text.slice(PAYMENT_NOTE_PREFIX.length)) as PaymentCapture;
  } catch {
    return null;
  }
}

function getReadableNoteText(language: AppLanguage, note: JobNote) {
  const payment = decodePaymentCapture(note.text);
  if (payment) {
    const copy = MOBILE_COPY[language];
    const paymentLabel = payment.paid ? copy.payment.yes : copy.payment.no;
    const methodLabel = payment.method ? PAYMENT_METHOD_LABELS[language][payment.method] : '';
    return [paymentLabel, methodLabel, payment.note].filter(Boolean).join(' • ');
  }

  return note.text;
}

function getLatestPaymentCapture(notes: JobNote[]) {
  for (let index = notes.length - 1; index >= 0; index -= 1) {
    const payload = decodePaymentCapture(notes[index].text);
    if (payload) {
      return payload;
    }
  }

  return null;
}

function buildJournalGroups(notes: JobNote[], attachments: Attachment[]) {
  const groups = new Map<string, JournalGroup>();

  notes.forEach((note) => {
    const bucket = groups.get(note.createdAt) || { createdAt: note.createdAt, notes: [], attachments: [] };
    bucket.notes.push(note);
    groups.set(note.createdAt, bucket);
  });

  attachments.forEach((attachment) => {
    const bucket = groups.get(attachment.createdAt) || { createdAt: attachment.createdAt, notes: [], attachments: [] };
    bucket.attachments.push(attachment);
    groups.set(attachment.createdAt, bucket);
  });

  return Array.from(groups.values()).sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

function getStageButton(job: Job, copy: { startJob: string; moveInProgress: string }) {
  if (job.status === 'SCHEDULED' || job.status === 'DISPATCHED' || job.status === 'NEW') {
    return { status: 'EN_ROUTE' as JobStatus, label: copy.startJob };
  }

  if (job.status === 'EN_ROUTE' || job.status === 'ON_HOLD') {
    return { status: 'IN_PROGRESS' as JobStatus, label: copy.moveInProgress };
  }

  return null;
}

async function readFileAsDataUrl(file: File) {
  const isImage = file.type.startsWith('image/');

  if (isImage) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error(`Unable to read ${file.name}`));
      reader.onload = () => {
        const image = new Image();
        image.onerror = () => reject(new Error(`Unable to process ${file.name}`));
        image.onload = () => {
          const maxDimension = 1600;
          const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(image.width * scale));
          canvas.height = Math.max(1, Math.round(image.height * scale));
          const context = canvas.getContext('2d');
          if (!context) {
            reject(new Error(`Unable to prepare ${file.name}`));
            return;
          }
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.82));
        };
        image.src = String(reader.result);
      };
      reader.readAsDataURL(file);
    });
  }

  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Unable to read ${file.name}`));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}

export const MobileApp: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const technicians = useTechStore((state) => state.technicians);
  const language = useUIStore((state) => state.language);
  const [searchParams, setSearchParams] = useSearchParams();

  if (!user) return null;

  const previewTechnicianId = getPreviewTechnicianId(user, technicians);
  const copy = MOBILE_COPY[language];
  const tabParam = searchParams.get('tab');
  const activeTab: MobileTab = isMobileTab(tabParam) ? tabParam : 'home';
  const selectedJobId = searchParams.get('job');

  const handleSelectTab = (tab: MobileTab) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('tab', tab);
    nextParams.delete('job');
    nextParams.delete('section');
    setSearchParams(nextParams, { replace: true });
  };

  const handleSelectJob = (jobId: string) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('job', jobId);
    nextParams.set('section', 'overview');
    setSearchParams(nextParams);
  };

  const handleBackToQueue = () => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('job');
    nextParams.delete('section');
    setSearchParams(nextParams, { replace: true });
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#08111b] text-white">
      <div className="flex items-center justify-between border-b border-white/10 px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))]">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">FSM</div>
          <div className="mt-1 text-sm font-semibold text-white/90">{copy.commandCenter}</div>
        </div>
        <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/65">
          {APP_LANGUAGE_LABELS[language]}
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {selectedJobId ? (
          <MobileJobDetail jobId={selectedJobId} onBack={handleBackToQueue} language={language} />
        ) : (
          <>
            {activeTab === 'home' && <MobileHome previewTechnicianId={previewTechnicianId} language={language} onSelectJob={handleSelectJob} />}
            {activeTab === 'jobs' && <MobileJobList previewTechnicianId={previewTechnicianId} language={language} onSelectJob={handleSelectJob} />}
            {activeTab === 'profile' && <MobileProfile previewTechnicianId={previewTechnicianId} language={language} />}
          </>
        )}
      </div>

      {!selectedJobId && (
        <div className="grid grid-cols-3 border-t border-white/10 bg-[#0d1723]/96 px-2 pb-[calc(0.4rem+env(safe-area-inset-bottom))] pt-1 backdrop-blur-xl">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;

            return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSelectTab(item.id)}
              className={cn(
                'mobile-tap flex flex-col items-center gap-1 rounded-2xl px-2 py-2.5 text-[11px] font-semibold uppercase tracking-[0.16em]',
                activeTab === item.id ? 'text-brand-200' : 'text-white/45',
              )}
            >
              <span
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-2xl border transition-all',
                  activeTab === item.id
                    ? 'border-brand-300/30 bg-brand-400/18 text-brand-100 shadow-[0_12px_30px_-18px_rgba(42,120,255,0.8)]'
                    : 'border-white/8 bg-white/[0.04] text-white/68',
                )}
              >
                <Icon className="h-[18px] w-[18px]" />
              </span>
              <span>{copy.tabs[item.id]}</span>
            </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

const MobileHome: React.FC<{
  previewTechnicianId?: string;
  language: AppLanguage;
  onSelectJob: (jobId: string) => void;
}> = ({ previewTechnicianId, language, onSelectJob }) => {
  const user = useAuthStore((state) => state.user);
  const jobs = useJobStore((state) => state.jobs);
  const syncState = useUIStore((state) => state.syncState);
  const copy = MOBILE_COPY[language];
  const today = toISODate(new Date());
  const visibleJobs = getVisibleTechnicianJobs(jobs, previewTechnicianId);
  const activeJob = visibleJobs.find((job) => ['EN_ROUTE', 'IN_PROGRESS', 'READY_FOR_SIGNATURE', 'ON_HOLD'].includes(job.status));
  const todayJobs = visibleJobs.filter((job) => job.scheduledDate === today && !CLOSED_JOB_STATUSES.includes(job.status));
  const upcomingJobs = visibleJobs.filter((job) => job.scheduledDate && job.scheduledDate > today && !CLOSED_JOB_STATUSES.includes(job.status)).slice(0, 4);
  const completedToday = visibleJobs.filter((job) => CLOSED_JOB_STATUSES.includes(job.status) && (job.actualEnd ? toISODate(new Date(job.actualEnd)) : job.scheduledDate) === today);

  return (
    <div className="h-full overflow-y-auto px-4 py-4">
      <div className="mb-5">
        <div className="text-sm text-white/55">
          {new Date().getHours() < 12 ? copy.greetingMorning : copy.greetingAfternoon}
        </div>
        <div className="mt-1 text-3xl font-semibold tracking-[-0.04em]">{user?.name?.split(' ')[0]}</div>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-white/58">{copy.statusIntro}</p>
      </div>

      <div className="mb-5 grid grid-cols-3 gap-3">
        <MetricCard label={copy.todayQueue} value={todayJobs.length} />
        <MetricCard label={copy.assigned} value={visibleJobs.length} />
        <MetricCard label={copy.completedToday} value={completedToday.length} />
      </div>

      <div className="mb-4 rounded-[26px] border border-white/10 bg-white/[0.05] p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/42">{copy.activeNow}</div>
            <div className="mt-2 text-lg font-semibold text-white/92">
              {activeJob ? activeJob.customerName : copy.noActiveJob}
            </div>
          </div>
          {activeJob && (
            <button
              type="button"
              onClick={() => onSelectJob(activeJob.id)}
              className="mobile-tap rounded-2xl bg-brand-500 px-4 py-2.5 text-xs font-semibold text-white"
            >
              {copy.openJob}
            </button>
          )}
        </div>
        {activeJob && (
          <div className="mt-4 space-y-2 text-sm text-white/64">
            <div>{getLocalizedStatus(language, activeJob.status)} • {activeJob.scheduledStart || '--:--'}</div>
            <div>{getAddressLine(activeJob)}</div>
            <a href={getMapsLink(activeJob)} target="_blank" rel="noreferrer" className="mobile-tap inline-flex rounded-full border border-white/12 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-brand-200">
              {copy.navigate}
            </a>
          </div>
        )}
      </div>

      <div className="mb-4 rounded-[24px] border border-white/10 bg-white/[0.04] p-4 text-sm text-white/70">
        <div className="flex items-center justify-between">
          <span>{copy.pendingChanges}</span>
          <span className="font-semibold text-white">{syncState.pendingChanges}</span>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span>{copy.lastSaved}</span>
          <span className="text-white/90">{syncState.lastSync ? formatDateTimeForLanguage(language, syncState.lastSync) : '--'}</span>
        </div>
      </div>

      <SectionHeading label={copy.todayQueue} />
      <div className="space-y-3">
        {todayJobs.length === 0 ? (
          <EmptyMobileState label={copy.noTodayJobs} />
        ) : todayJobs.map((job) => (
          <MobileJobCard key={job.id} job={job} language={language} onOpen={onSelectJob} />
        ))}
      </div>

      <SectionHeading label={copy.upcoming} className="mt-6" />
      <div className="space-y-3">
        {upcomingJobs.length === 0 ? (
          <EmptyMobileState label={copy.hiddenHistory} />
        ) : upcomingJobs.map((job) => (
          <MobileJobCard key={job.id} job={job} language={language} onOpen={onSelectJob} />
        ))}
      </div>
    </div>
  );
};

const MobileJobList: React.FC<{
  previewTechnicianId?: string;
  language: AppLanguage;
  onSelectJob: (jobId: string) => void;
}> = ({ previewTechnicianId, language, onSelectJob }) => {
  const jobs = useJobStore((state) => state.jobs);
  const copy = MOBILE_COPY[language];
  const [filter, setFilter] = useState<MobileJobFilter>('active');
  const today = toISODate(new Date());
  const visibleJobs = getVisibleTechnicianJobs(jobs, previewTechnicianId);

  const filteredJobs = visibleJobs.filter((job) => {
    if (filter === 'active') return ACTIVE_JOB_STATUSES.includes(job.status);
    if (filter === 'today') return job.scheduledDate === today && !CLOSED_JOB_STATUSES.includes(job.status);
    if (filter === 'upcoming') return Boolean(job.scheduledDate && job.scheduledDate > today && !CLOSED_JOB_STATUSES.includes(job.status));
    return CLOSED_JOB_STATUSES.includes(job.status) && (job.actualEnd ? toISODate(new Date(job.actualEnd)) : job.scheduledDate) === today;
  });

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-white/10 px-4 py-4">
        <h1 className="text-2xl font-semibold tracking-[-0.04em] text-white">{copy.tabs.jobs}</h1>
        <p className="mt-2 text-sm text-white/58">{copy.hiddenHistory}</p>
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {(['active', 'today', 'upcoming', 'completed'] as MobileJobFilter[]).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              className={cn(
                'mobile-tap rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em]',
                filter === value ? 'bg-brand-500 text-white' : 'bg-white/8 text-white/58 hover:bg-white/12 hover:text-white/84',
              )}
            >
              {copy.filters[value]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {filteredJobs.length === 0 ? (
          <EmptyMobileState label={copy.noVisibleJobs} />
        ) : filteredJobs.map((job) => (
          <MobileJobCard key={job.id} job={job} language={language} onOpen={onSelectJob} />
        ))}
      </div>
    </div>
  );
};

const MobileProfile: React.FC<{ previewTechnicianId?: string; language: AppLanguage }> = ({ previewTechnicianId, language }) => {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const jobs = useJobStore((state) => state.jobs);
  const syncState = useUIStore((state) => state.syncState);
  const triggerSync = useUIStore((state) => state.triggerSync);
  const setLanguage = useUIStore((state) => state.setLanguage);
  const copy = MOBILE_COPY[language];
  const visibleJobs = getVisibleTechnicianJobs(jobs, previewTechnicianId);
  const today = toISODate(new Date());

  if (!user) return null;

  return (
    <div className="h-full overflow-y-auto px-4 py-4">
      <h1 className="text-2xl font-semibold tracking-[-0.04em] text-white">{copy.profileTitle}</h1>
      <div className="mt-4 rounded-[28px] border border-white/10 bg-white/[0.05] p-4">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500/20 text-lg font-semibold text-brand-100">
            {user.avatarInitials}
          </div>
          <div>
            <div className="text-lg font-semibold text-white">{user.name}</div>
            <div className="text-sm text-white/52">{copy.technicianMode}</div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <MetricCard label={copy.todayQueue} value={visibleJobs.filter((job) => job.scheduledDate === today && !CLOSED_JOB_STATUSES.includes(job.status)).length} compact />
          <MetricCard label={copy.completedToday} value={visibleJobs.filter((job) => CLOSED_JOB_STATUSES.includes(job.status) && (job.actualEnd ? toISODate(new Date(job.actualEnd)) : job.scheduledDate) === today).length} compact />
        </div>

        <div className="mt-4 rounded-2xl border border-white/8 bg-[#0d1723] p-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/42">{copy.labels.language}</div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {(['en', 'fr'] as AppLanguage[]).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setLanguage(value)}
                className={cn(
                  'mobile-tap rounded-xl px-3 py-2.5 text-sm font-semibold',
                  language === value ? 'bg-brand-500 text-white' : 'bg-white/6 text-white/65 hover:bg-white/12',
                )}
              >
                {APP_LANGUAGE_LABELS[value]}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-white/8 bg-[#0d1723] p-3 text-sm text-white/70">
          <div className="flex items-center justify-between">
            <span>{copy.lastSaved}</span>
            <span className="text-white/92">{syncState.lastSync ? formatDateTimeForLanguage(language, syncState.lastSync) : '--'}</span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span>{copy.pendingChanges}</span>
            <span className="font-semibold text-white">{syncState.pendingChanges}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void triggerSync()}
          disabled={syncState.status === 'SYNCING'}
          className="mobile-tap mt-4 w-full rounded-2xl bg-brand-500 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
        >
          {syncState.status === 'SYNCING' ? copy.syncing : copy.syncNow}
        </button>

        <button
          type="button"
          onClick={logout}
          className="mobile-tap mt-3 w-full rounded-2xl border border-white/12 bg-transparent px-4 py-3 text-sm font-semibold text-white/80"
        >
          {copy.signOut}
        </button>
      </div>
    </div>
  );
};

const MobileJobCard: React.FC<{
  job: Job;
  language: AppLanguage;
  onOpen: (jobId: string) => void;
}> = ({ job, language, onOpen }) => {
  const statusLabel = getLocalizedStatus(language, job.status);

  return (
    <div className="rounded-[24px] border border-white/10 bg-white/[0.05] p-4 shadow-[0_20px_60px_-40px_rgba(0,0,0,0.6)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-200">{job.jobNumber}</div>
          <div className="mt-1 text-lg font-semibold tracking-[-0.02em] text-white">{job.customerName}</div>
          <div className="mt-1 text-sm text-white/58">{job.description}</div>
        </div>
        <span className="rounded-full border border-white/12 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/72">
          {statusLabel}
        </span>
      </div>

      <div className="mt-4 grid gap-2 text-sm text-white/66">
        <div>{formatShortDateForLanguage(language, job.scheduledDate)} • {job.scheduledStart || '--:--'}</div>
        <div>{getAddressLine(job)}</div>
        <div>{getLocalizedServiceType(language, job.serviceType)} • {PRIORITY_LABELS_BY_LANGUAGE[language][job.priority]}</div>
      </div>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={() => onOpen(job.id)}
          className="mobile-tap flex-1 rounded-2xl bg-brand-500 px-4 py-3 text-sm font-semibold text-white"
        >
          {MOBILE_COPY[language].openJob}
        </button>
        <a
          href={getMapsLink(job)}
          target="_blank"
          rel="noreferrer"
          className="mobile-tap rounded-2xl border border-white/12 px-4 py-3 text-sm font-semibold text-white/76"
        >
          {MOBILE_COPY[language].navigate}
        </a>
      </div>
    </div>
  );
};

const MobileJobDetail: React.FC<{
  jobId: string;
  onBack: () => void;
  language: AppLanguage;
}> = ({ jobId, onBack, language }) => {
  const getJob = useJobStore((state) => state.getJob);
  const getNotes = useJobStore((state) => state.getNotes);
  const getUnifiedFilesForJob = useJobStore((state) => state.getUnifiedFilesForJob);
  const updateJob = useJobStore((state) => state.updateJob);
  const updateStatus = useJobStore((state) => state.updateStatus);
  const addNote = useJobStore((state) => state.addNote);
  const addAttachment = useJobStore((state) => state.addAttachment);
  const getSO = useSOStore((state) => state.getSO);
  const addSOLine = useSOStore((state) => state.addSOLine);
  const updateSO = useSOStore((state) => state.updateSO);
  const user = useAuthStore((state) => state.user);
  const toast = useUIStore((state) => state.toast);
  const [searchParams, setSearchParams] = useSearchParams();

  const copy = MOBILE_COPY[language];
  const job = getJob(jobId);
  const [reportText, setReportText] = useState('');
  const [journalText, setJournalText] = useState('');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [isSavingJournal, setIsSavingJournal] = useState(false);
  const [customerSignature, setCustomerSignature] = useState<string | undefined>();
  const [technicianSignature, setTechnicianSignature] = useState<string | undefined>();
  const [paymentChoice, setPaymentChoice] = useState<'unknown' | 'no' | 'yes'>('unknown');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CARD');
  const [paymentNote, setPaymentNote] = useState('');
  const [selectedCatalogItemId, setSelectedCatalogItemId] = useState(APPROVED_ITEM_CATALOG[0].id);
  const [selectedQuantity, setSelectedQuantity] = useState('1');
  const [selectedLineNote, setSelectedLineNote] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const sectionParam = searchParams.get('section');
  const activeTab: MobileJobTab = isMobileJobTab(sectionParam) ? sectionParam : 'overview';

  useEffect(() => {
    if (!job) return;
    setReportText(job.resolution || '');
    setCustomerSignature(job.completionSignature);
    setTechnicianSignature(job.techSignature);
  }, [job?.id, job?.resolution, job?.completionSignature, job?.techSignature]);

  if (!job || !user) return null;

  const setJobTab = (tab: MobileJobTab) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('job', job.id);
    nextParams.set('section', tab);
    setSearchParams(nextParams, { replace: true });
  };

  const notes = getNotes(job.id);
  const attachments = getUnifiedFilesForJob(job.id);
  const linkedSalesOrder = job.salesOrderId ? getSO(job.salesOrderId) : undefined;
  const paymentCapture = getLatestPaymentCapture(notes);
  const journalGroups = buildJournalGroups(notes, attachments);
  const stageButton = getStageButton(job, copy.buttons);
  const completionReady = Boolean(reportText.trim()) && Boolean(customerSignature);
  const selectedCatalogItem = APPROVED_ITEM_CATALOG.find((item) => item.id === selectedCatalogItemId) || APPROVED_ITEM_CATALOG[0];
  const reportOnFile = Boolean(job.resolution?.trim());
  const signatureOnFile = Boolean(job.completionSignature);
  const canMoveToSignature = Boolean(reportText.trim());
  const canCompleteJob = job.status === 'READY_FOR_SIGNATURE' && completionReady;

  useEffect(() => {
    if (!paymentCapture) return;
    setPaymentChoice(paymentCapture.paid ? 'yes' : 'no');
    if (paymentCapture.method) {
      setPaymentMethod(paymentCapture.method);
    }
    setPaymentNote(paymentCapture.note || '');
  }, [paymentCapture?.recordedAt]);

  const saveReport = () => {
    const nextReport = reportText.trim();
    if (!nextReport) {
      toast('warning', copy.reportRequired);
      return;
    }

    updateJob(job.id, { resolution: nextReport });
    addNote(job.id, copy.reportSaved, 'ACTIVITY', user.id, user.name, { visibility: 'TECHNICIAN_ONLY' });
    toast('success', copy.reportSaved);
  };

  const savePayment = () => {
    if (paymentChoice === 'unknown') {
      toast('warning', copy.choosePaymentState);
      return;
    }

    const capture: PaymentCapture = {
      paid: paymentChoice === 'yes',
      method: paymentChoice === 'yes' ? paymentMethod : undefined,
      note: paymentNote.trim() || undefined,
      recordedAt: new Date().toISOString(),
      recordedBy: user.name,
    };

    addNote(job.id, encodePaymentCapture(capture), 'ACTIVITY', user.id, user.name, { visibility: 'TECHNICIAN_ONLY' });
    if (linkedSalesOrder) {
      updateSO(linkedSalesOrder.id, {
        paymentMode: capture.paid ? PAYMENT_METHOD_LABELS.en[capture.method || 'CARD'] : 'No payment collected',
      });
    }
    toast('success', copy.payment.saved);
  };

  const saveSignatures = () => {
    updateJob(job.id, {
      completionSignature: customerSignature,
      techSignature: technicianSignature,
      completionSignedBy: customerSignature ? (job.contactName || job.customerName) : job.completionSignedBy,
    });
    addNote(job.id, copy.signatureSaved, 'ACTIVITY', user.id, user.name, { visibility: 'TECHNICIAN_ONLY' });
    toast('success', copy.signatureSaved);
  };

  const handlePickFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    const acceptedFiles = files.filter((file) => file.size <= MAX_ATTACHMENT_SIZE_BYTES);
    if (acceptedFiles.length !== files.length) {
      toast('warning', copy.fileTooLarge);
    }

    if (acceptedFiles.length > 0) {
      setPendingFiles((current) => [...current, ...acceptedFiles]);
    }
    event.target.value = '';
  };

  const handleSaveJournalEntry = async () => {
    if (!journalText.trim() && pendingFiles.length === 0) return;

    setIsSavingJournal(true);
    const createdAt = new Date().toISOString();

    try {
      let savedNames: string[] = [];
      if (pendingFiles.length > 0) {
        const preparedFiles = await Promise.all(
          pendingFiles.map(async (file) => ({
            file,
            url: await readFileAsDataUrl(file),
          })),
        );

        preparedFiles.forEach(({ file, url }) => {
          addAttachment({
            customerId: job.customerId,
            jobId: job.id,
            jobNumber: job.jobNumber,
            soId: linkedSalesOrder?.id,
            soNumber: linkedSalesOrder?.soNumber,
            name: file.name,
            type: file.type || 'application/octet-stream',
            size: file.size,
            url,
            source: 'JOB',
            uploadedBy: user.name,
            createdAt,
          });
        });
        savedNames = preparedFiles.map((entry) => entry.file.name);
      }

      const message = journalText.trim() || `Added attachments: ${savedNames.join(', ')}`;
      addNote(job.id, message, 'TECHNICIAN', user.id, user.name, {
        createdAt,
        visibility: 'TECHNICIAN_ONLY',
      });

      setJournalText('');
      setPendingFiles([]);
      toast('success', copy.journalSaved);
    } catch (error) {
      toast('error', error instanceof Error ? error.message : 'Unable to save this entry.');
    } finally {
      setIsSavingJournal(false);
    }
  };

  const handleAddApprovedLine = () => {
    if (!linkedSalesOrder) {
      toast('warning', copy.salesEmpty);
      return;
    }

    const quantity = Math.max(1, Number(selectedQuantity) || 1);
    addSOLine(linkedSalesOrder.id, {
      itemId: selectedCatalogItem.id,
      itemName: selectedCatalogItem.label,
      description: [selectedCatalogItem.description, selectedLineNote.trim()].filter(Boolean).join(' • '),
      quantity,
      rate: selectedCatalogItem.rate,
      amount: quantity * selectedCatalogItem.rate,
    });
    addNote(
      job.id,
      `${copy.lineAdded} ${selectedCatalogItem.label} x${quantity}${selectedLineNote.trim() ? ` • ${selectedLineNote.trim()}` : ''}`,
      'ACTIVITY',
      user.id,
      user.name,
      { visibility: 'TECHNICIAN_ONLY' },
    );
    setSelectedQuantity('1');
    setSelectedLineNote('');
    toast('success', copy.lineAdded);
  };

  const handleReadyForSignature = () => {
    const nextReport = reportText.trim();
    if (!nextReport) {
      toast('warning', copy.reportUnlocksSignature);
      setJobTab('overview');
      return;
    }

    if (job.resolution !== nextReport) {
      updateJob(job.id, { resolution: nextReport });
    }

    updateStatus(job.id, 'READY_FOR_SIGNATURE');
    setJobTab('closeout');
    toast('success', copy.readyForSignatureNote);
  };

  const handleCompleteJob = () => {
    if (!canCompleteJob) {
      toast('warning', copy.cannotComplete);
      return;
    }

    updateJob(job.id, {
      resolution: reportText.trim(),
      completionSignature: customerSignature,
      techSignature: technicianSignature,
      completionSignedBy: job.contactName || job.customerName,
      actualEnd: new Date().toISOString(),
    });
    updateStatus(job.id, 'COMPLETED');
    addNote(job.id, copy.jobCompleted, 'ACTIVITY', user.id, user.name, { visibility: 'TECHNICIAN_ONLY' });
    toast('success', copy.jobCompleted);
  };

  return (
    <div className="flex h-full flex-col bg-[#08111b]">
      <div className="border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="mobile-tap inline-flex items-center gap-2 rounded-xl border border-white/12 bg-white/5 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-white/78"
          >
            <BackIcon className="h-4 w-4" />
            {copy.buttons.back}
          </button>
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-200">{job.jobNumber}</div>
            <div className="truncate text-lg font-semibold tracking-[-0.03em] text-white">{job.customerName}</div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-white/64">
          <span className="rounded-full border border-white/12 px-3 py-1">{getLocalizedStatus(language, job.status)}</span>
          <span className="rounded-full border border-white/12 px-3 py-1">{formatShortDateForLanguage(language, job.scheduledDate)} • {job.scheduledStart || '--:--'}</span>
          <a href={getMapsLink(job)} target="_blank" rel="noreferrer" className="mobile-tap rounded-full border border-brand-400/30 px-3 py-1 font-semibold text-brand-200">
            {copy.directions}
          </a>
        </div>
      </div>

      <div className="border-b border-white/10 px-4 py-3">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {([
            { id: 'overview', label: copy.sections.summary },
            { id: 'journal', label: copy.sections.fieldJournal },
            { id: 'sales', label: copy.sections.salesOrder },
            { id: 'closeout', label: copy.sections.closeout },
          ] as Array<{ id: MobileJobTab; label: string }>).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setJobTab(tab.id)}
              className={cn(
                'mobile-tap rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em]',
                activeTab === tab.id ? 'bg-brand-500 text-white' : 'bg-white/8 text-white/58 hover:bg-white/12 hover:text-white/84',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-32 pt-4">
        {activeTab === 'overview' && (
          <div className="space-y-4">
            <InfoCard title={copy.sections.summary}>
              <InfoRow label={copy.labels.customer} value={job.customerName} />
              <InfoRow label={copy.labels.contact} value={job.contactName} />
              <InfoRow label={copy.labels.phone} value={job.contactPhone} link={job.contactPhone ? `tel:${job.contactPhone}` : undefined} />
              <InfoRow label={copy.labels.email} value={job.contactEmail} link={job.contactEmail ? `mailto:${job.contactEmail}` : undefined} />
              <InfoRow label={copy.labels.address} value={getAddressLine(job)} />
              <InfoRow label={copy.labels.serviceType} value={getLocalizedServiceType(language, job.serviceType)} />
              <InfoRow label={copy.labels.priority} value={PRIORITY_LABELS_BY_LANGUAGE[language][job.priority]} />
              <InfoRow label={copy.labels.scheduled} value={`${formatDateForLanguage(language, job.scheduledDate)} ${job.scheduledStart || ''}`.trim()} />
              <InfoRow label={copy.sections.salesOrder} value={linkedSalesOrder?.soNumber || job.salesOrderNumber || '—'} />
            </InfoCard>

            <InfoCard title={copy.sections.dispatcherNotes}>
              <p className="text-sm leading-relaxed text-white/72">{job.internalNotes || copy.auditLocked}</p>
            </InfoCard>

            <InfoCard title={copy.sections.report}>
              <textarea
                className="mobile-input min-h-[150px]"
                value={reportText}
                onChange={(event) => setReportText(event.target.value)}
                placeholder={copy.labels.reportPlaceholder}
              />
              <button
                type="button"
                onClick={saveReport}
                className="mobile-tap mt-3 w-full rounded-2xl bg-brand-500 px-4 py-3 text-sm font-semibold text-white"
              >
                {copy.buttons.saveReport}
              </button>
            </InfoCard>
          </div>
        )}

        {activeTab === 'journal' && (
          <div className="space-y-4">
            <InfoCard title={copy.sections.fieldJournal}>
              <textarea
                className="mobile-input min-h-[120px]"
                value={journalText}
                onChange={(event) => setJournalText(event.target.value)}
                placeholder={copy.labels.journalPlaceholder}
              />
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="mobile-tap inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-white/12 bg-white/6 px-4 py-3 text-sm font-semibold text-white/78"
                >
                  <CameraIcon className="h-4 w-4" />
                  {copy.buttons.addFromCamera}
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="mobile-tap inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-white/12 bg-white/6 px-4 py-3 text-sm font-semibold text-white/78"
                >
                  <AttachmentIcon className="h-4 w-4" />
                  {copy.buttons.addFiles}
                </button>
              </div>
              <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" multiple onChange={handlePickFiles} />
              <input ref={fileInputRef} type="file" className="hidden" multiple onChange={handlePickFiles} />

              {pendingFiles.length > 0 && (
                <div className="mt-4 rounded-2xl border border-white/8 bg-[#0d1723] p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">{copy.attachmentsReady}</div>
                  <div className="mt-3 space-y-2">
                    {pendingFiles.map((file, index) => (
                      <div key={`${file.name}-${index}`} className="flex items-center justify-between gap-3 rounded-xl bg-white/6 px-3 py-2 text-sm">
                        <div className="min-w-0">
                          <div className="truncate text-white/90">{file.name}</div>
                          <div className="text-xs text-white/45">{formatFileSize(file.size)}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setPendingFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))}
                          className="mobile-tap text-xs font-semibold uppercase tracking-[0.14em] text-white/55"
                        >
                          {copy.buttons.clear}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={() => void handleSaveJournalEntry()}
                disabled={isSavingJournal || (!journalText.trim() && pendingFiles.length === 0)}
                className="mobile-tap mt-4 w-full rounded-2xl bg-brand-500 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
              >
                {isSavingJournal ? copy.syncing : copy.buttons.saveJournal}
              </button>
            </InfoCard>

            <InfoCard title={copy.sections.fieldJournal}>
              <div className="mb-3 rounded-2xl border border-white/8 bg-[#0d1723] px-3 py-3 text-sm text-white/58">
                {copy.auditLocked}
              </div>
              {journalGroups.length === 0 ? (
                <EmptyMobileState label={copy.journalEmpty} />
              ) : journalGroups.map((group) => (
                <JournalGroupCard key={group.createdAt} group={group} language={language} />
              ))}
            </InfoCard>
          </div>
        )}

        {activeTab === 'sales' && (
          <div className="space-y-4">
            <InfoCard title={copy.sections.salesOrder}>
              <div className="rounded-2xl border border-white/8 bg-[#0d1723] px-3 py-3 text-sm text-white/58">
                {copy.salesRestricted}
              </div>
              {!linkedSalesOrder ? (
                <EmptyMobileState label={copy.salesEmpty} />
              ) : (
                <>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <MetricCard label={copy.sections.salesOrder} value={linkedSalesOrder.soNumber} compact />
                    <MetricCard label={copy.labels.total} value={formatCurrencyForLanguage(language, linkedSalesOrder.total)} compact />
                    <MetricCard label={copy.labels.balance} value={formatCurrencyForLanguage(language, linkedSalesOrder.balance || 0)} compact />
                    <MetricCard label={copy.labels.paymentMethod} value={linkedSalesOrder.paymentMode || copy.payment.unknown} compact />
                  </div>

                  <div className="mt-4 rounded-2xl border border-white/8 bg-[#0d1723] p-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">{copy.sections.approvedItems}</div>
                    <div className="mt-3 space-y-3">
                      <label className="block">
                        <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/42">{copy.labels.catalog}</div>
                        <select
                          className="mobile-input"
                          value={selectedCatalogItemId}
                          onChange={(event) => setSelectedCatalogItemId(event.target.value)}
                        >
                          {APPROVED_ITEM_CATALOG.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.label} • {formatCurrencyForLanguage(language, item.rate)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="rounded-2xl bg-white/6 px-3 py-3 text-sm text-white/70">
                        <div className="font-semibold text-white/92">{selectedCatalogItem.label}</div>
                        <div className="mt-1">{selectedCatalogItem.description}</div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <label className="block">
                          <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/42">{copy.labels.qty}</div>
                          <input className="mobile-input" type="number" min="1" value={selectedQuantity} onChange={(event) => setSelectedQuantity(event.target.value)} />
                        </label>
                        <label className="block">
                          <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/42">{copy.labels.rate}</div>
                          <input className="mobile-input" value={formatCurrencyForLanguage(language, selectedCatalogItem.rate)} readOnly />
                        </label>
                      </div>
                      <label className="block">
                        <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/42">{copy.labels.note}</div>
                        <textarea className="mobile-input min-h-[88px]" value={selectedLineNote} onChange={(event) => setSelectedLineNote(event.target.value)} placeholder={copy.lineNotePlaceholder} />
                      </label>
                      <button
                        type="button"
                        onClick={handleAddApprovedLine}
                        className="mobile-tap w-full rounded-2xl bg-brand-500 px-4 py-3 text-sm font-semibold text-white"
                      >
                        {copy.buttons.addLine}
                      </button>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/8 bg-[#0d1723] p-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">{copy.sections.lineItems}</div>
                    <div className="mt-3 space-y-2">
                      {linkedSalesOrder.lines.length === 0 ? (
                        <EmptyMobileState label={copy.lineRestricted} />
                      ) : linkedSalesOrder.lines.map((line) => (
                        <SalesOrderLineCard key={line.id} line={line} language={language} />
                      ))}
                    </div>
                  </div>
                </>
              )}
            </InfoCard>
          </div>
        )}

        {activeTab === 'closeout' && (
          <div className="space-y-4">
            <InfoCard title={copy.sections.closeout}>
              <div className="space-y-3">
                <RequirementRow label={copy.reportRequired} complete={reportOnFile} completeLabel={copy.reportSavedLabel} pendingLabel={copy.pending} />
                <RequirementRow label={copy.signatureRequired} complete={signatureOnFile} completeLabel={copy.signatureSavedLabel} pendingLabel={copy.pending} />
              </div>
            </InfoCard>

            <InfoCard title={copy.sections.payment}>
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { id: 'unknown', label: copy.payment.unknown },
                    { id: 'no', label: copy.payment.no },
                    { id: 'yes', label: copy.payment.yes },
                  ] as Array<{ id: 'unknown' | 'no' | 'yes'; label: string }>).map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setPaymentChoice(option.id)}
                      className={cn(
                        'mobile-tap rounded-xl px-3 py-3 text-xs font-semibold uppercase tracking-[0.14em]',
                        paymentChoice === option.id ? 'bg-brand-500 text-white' : 'bg-white/6 text-white/58 hover:bg-white/12 hover:text-white/84',
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

                {paymentChoice === 'yes' && (
                  <label className="block">
                    <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/42">{copy.labels.paymentMethod}</div>
                    <select className="mobile-input" value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}>
                      {(Object.keys(PAYMENT_METHOD_LABELS[language]) as PaymentMethod[]).map((method) => (
                        <option key={method} value={method}>{PAYMENT_METHOD_LABELS[language][method]}</option>
                      ))}
                    </select>
                  </label>
                )}

                <label className="block">
                  <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/42">{copy.labels.paymentNote}</div>
                  <textarea className="mobile-input min-h-[88px]" value={paymentNote} onChange={(event) => setPaymentNote(event.target.value)} placeholder={copy.lineNotePlaceholder} />
                </label>

                <button
                  type="button"
                  onClick={savePayment}
                  className="mobile-tap w-full rounded-2xl bg-brand-500 px-4 py-3 text-sm font-semibold text-white"
                >
                  {copy.buttons.savePayment}
                </button>
              </div>
            </InfoCard>

            <InfoCard title={copy.sections.signatures}>
              <div className="space-y-4">
                <div>
                  <div className="mb-2 text-sm font-semibold text-white/92">{copy.sections.customerSignature}</div>
                  <SignaturePad height={128} value={customerSignature} onChange={setCustomerSignature} clearLabel={copy.buttons.clear} />
                </div>
                <div>
                  <div className="mb-2 text-sm font-semibold text-white/92">{copy.sections.techSignature}</div>
                  <SignaturePad height={108} value={technicianSignature} onChange={setTechnicianSignature} clearLabel={copy.buttons.clear} />
                </div>
                <button
                  type="button"
                  onClick={saveSignatures}
                  className="mobile-tap w-full rounded-2xl border border-white/12 bg-white/6 px-4 py-3 text-sm font-semibold text-white/80"
                >
                  {copy.signatureSaved}
                </button>
              </div>
            </InfoCard>
          </div>
        )}
      </div>

      <div className="sticky bottom-0 border-t border-white/10 bg-[#0d1723]/96 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl">
        <div className="mb-3 flex flex-wrap gap-2">
          <WorkflowChip label={getLocalizedStatus(language, job.status)} tone="neutral" />
          <WorkflowChip label={reportOnFile ? copy.reportSavedLabel : copy.reportRequired} tone={reportOnFile ? 'success' : 'pending'} />
          <WorkflowChip label={signatureOnFile ? copy.signatureSavedLabel : copy.signatureRequired} tone={signatureOnFile ? 'success' : 'pending'} />
        </div>
        <div className="grid gap-2">
          {stageButton && (
            <button
              type="button"
              onClick={() => {
                updateStatus(job.id, stageButton.status);
                toast('success', getLocalizedStatus(language, stageButton.status));
              }}
              className="mobile-tap w-full rounded-2xl bg-brand-500 px-4 py-4 text-base font-semibold text-white"
            >
              {stageButton.label}
            </button>
          )}

          {job.status === 'IN_PROGRESS' && (
            <button
              type="button"
              onClick={handleReadyForSignature}
              disabled={!canMoveToSignature}
              className="mobile-tap w-full rounded-2xl border border-white/12 bg-white/6 px-4 py-4 text-base font-semibold text-white/86 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {copy.buttons.readyForSignature}
            </button>
          )}

          <button
            type="button"
            onClick={handleCompleteJob}
            disabled={!canCompleteJob}
            className="mobile-tap w-full rounded-2xl bg-emerald-500 px-4 py-4 text-base font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
          >
            {copy.buttons.completeJob}
          </button>
        </div>
      </div>
    </div>
  );
};

const MetricCard: React.FC<{ label: string; value: number | string; compact?: boolean }> = ({ label, value, compact }) => (
  <div className={cn('rounded-[22px] border border-white/10 bg-white/[0.05] p-3', compact && 'rounded-2xl')}>
    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/42">{label}</div>
    <div className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-white">{value}</div>
  </div>
);

const SectionHeading: React.FC<{ label: string; className?: string }> = ({ label, className }) => (
  <div className={cn('mb-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/42', className)}>{label}</div>
);

const EmptyMobileState: React.FC<{ label: string }> = ({ label }) => (
  <div className="rounded-[24px] border border-white/8 bg-white/[0.03] px-4 py-6 text-center text-sm text-white/46">
    {label}
  </div>
);

const InfoCard: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="rounded-[26px] border border-white/10 bg-white/[0.05] p-4">
    <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/42">{title}</div>
    {children}
  </div>
);

const InfoRow: React.FC<{ label: string; value?: string; link?: string }> = ({ label, value, link }) => {
  if (!value || value === '—') return null;

  return (
    <div className="flex items-start justify-between gap-3 border-b border-white/6 py-2 text-sm last:border-b-0">
      <span className="text-white/46">{label}</span>
      {link ? (
        <a href={link} className="max-w-[58%] text-right font-semibold text-brand-200">{value}</a>
      ) : (
        <span className="max-w-[58%] text-right font-semibold text-white/88">{value}</span>
      )}
    </div>
  );
};

const JournalGroupCard: React.FC<{ group: JournalGroup; language: AppLanguage }> = ({ group, language }) => {
  const primaryNote = group.notes[0];

  return (
    <div className="rounded-2xl border border-white/8 bg-[#0d1723] p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold text-white/92">{primaryNote?.authorName || group.attachments[0]?.uploadedBy || 'FSM'}</div>
        <div className="text-xs text-white/42">{formatDateTimeForLanguage(language, group.createdAt)}</div>
      </div>

      <div className="mt-3 space-y-3">
        {group.notes.map((note) => (
          <p key={note.id} className="text-sm leading-relaxed text-white/74">
            {getReadableNoteText(language, note)}
          </p>
        ))}

        {group.attachments.map((attachment) => (
          <AttachmentCard key={attachment.id} attachment={attachment} language={language} />
        ))}
      </div>
    </div>
  );
};

const AttachmentCard: React.FC<{ attachment: Attachment; language: AppLanguage }> = ({ attachment, language }) => {
  const isImage = attachment.type.startsWith('image/');

  return (
    <div className="rounded-2xl border border-white/8 bg-white/6 p-3">
      {isImage && (
        <img src={attachment.url} alt={attachment.name} className="mb-3 h-40 w-full rounded-xl object-cover" />
      )}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-white/90">{attachment.name}</div>
          <div className="mt-1 text-xs text-white/45">{attachment.type} • {formatFileSize(attachment.size)}</div>
        </div>
        <a href={attachment.url} target="_blank" rel="noreferrer" className="mobile-tap text-xs font-semibold uppercase tracking-[0.14em] text-brand-200">
          {MOBILE_COPY[language].openAttachment}
        </a>
      </div>
    </div>
  );
};

const SalesOrderLineCard: React.FC<{ line: SOLine; language: AppLanguage }> = ({ line, language }) => (
  <div className="rounded-2xl border border-white/8 bg-white/6 p-3">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold text-white/92">{line.itemName}</div>
        <div className="mt-1 text-xs text-white/45">{line.description || '—'}</div>
      </div>
      <div className="text-right">
        <div className="text-sm font-semibold text-white">{formatCurrencyForLanguage(language, line.amount)}</div>
        <div className="text-xs text-white/45">{line.quantity} × {formatCurrencyForLanguage(language, line.rate)}</div>
      </div>
    </div>
  </div>
);

const WorkflowChip: React.FC<{ label: string; tone: 'neutral' | 'success' | 'pending' }> = ({ label, tone }) => (
  <div
    className={cn(
      'rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em]',
      tone === 'success' && 'border-emerald-400/20 bg-emerald-500/10 text-emerald-200',
      tone === 'pending' && 'border-amber-300/20 bg-amber-500/10 text-amber-100',
      tone === 'neutral' && 'border-white/10 bg-white/[0.04] text-white/68',
    )}
  >
    {label}
  </div>
);

const RequirementRow: React.FC<{ label: string; complete: boolean; completeLabel: string; pendingLabel?: string }> = ({ label, complete, completeLabel, pendingLabel = 'Pending' }) => (
  <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-[#0d1723] px-3 py-3">
    <div className="text-sm text-white/72">{label}</div>
    <div className={cn('text-xs font-semibold uppercase tracking-[0.16em]', complete ? 'text-emerald-300' : 'text-amber-200')}>
      {complete ? completeLabel : pendingLabel}
    </div>
  </div>
);

const SignaturePad: React.FC<{
  value?: string;
  onChange: (value?: string) => void;
  height: number;
  clearLabel: string;
}> = ({ value, onChange, height, clearLabel }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext('2d');
    if (!context) return;

    const ratio = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const canvasHeight = canvas.clientHeight;
    canvas.width = width * ratio;
    canvas.height = canvasHeight * ratio;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.fillStyle = 'rgba(255,255,255,0.03)';
    context.fillRect(0, 0, width, canvasHeight);
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.lineWidth = 2.5;
    context.strokeStyle = '#f8fafc';

    if (!value) return;

    const image = new Image();
    image.onload = () => {
      context.fillStyle = 'rgba(255,255,255,0.03)';
      context.fillRect(0, 0, width, canvasHeight);
      context.drawImage(image, 0, 0, width, canvasHeight);
    };
    image.src = value;
  }, [value, height]);

  const getPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const startDrawing = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    const point = getPoint(event);
    if (!canvas || !context || !point) return;

    drawingRef.current = true;
    canvas.setPointerCapture(event.pointerId);
    context.beginPath();
    context.moveTo(point.x, point.y);
  };

  const keepDrawing = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    const point = getPoint(event);
    if (!canvas || !context || !point) return;

    context.lineTo(point.x, point.y);
    context.stroke();
  };

  const finishDrawing = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    onChange(canvasRef.current?.toDataURL('image/png'));
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;

    context.fillStyle = 'rgba(255,255,255,0.03)';
    context.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    onChange(undefined);
  };

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-white/8 bg-white/[0.03]" style={{ height }}>
        <canvas
          ref={canvasRef}
          className="h-full w-full touch-none"
          onPointerDown={startDrawing}
          onPointerMove={keepDrawing}
          onPointerUp={finishDrawing}
          onPointerLeave={finishDrawing}
          onPointerCancel={finishDrawing}
        />
      </div>
      <button type="button" onClick={clearSignature} className="mobile-tap mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-white/52">
        {clearLabel}
      </button>
    </>
  );
};
