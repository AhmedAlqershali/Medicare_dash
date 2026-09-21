import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Eye } from 'lucide-react'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { DataToolbar } from '../components/DataToolbar'
import { Modal } from '../components/Modal'
import { PageHeader } from '../components/PageHeader'
import { StatusBadge } from '../components/StatusBadge'
import { subscribeToCollection, updateRecord, type FirestoreRecord } from '../lib/firestoreService'

type Organization = FirestoreRecord & { name: string }
type Clinic = FirestoreRecord & { name: string; organizationId: string }
type Doctor = FirestoreRecord & { name: string; organizationId: string; clinicId: string }
type Patient = FirestoreRecord & { name: string; organizationId: string; clinicId: string }
type Appointment = FirestoreRecord & { patientId: string; doctorId: string; organizationId: string; clinicId: string; date: unknown; status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no-show'; notes?: string }

const appointmentStatuses = [
  { value: 'scheduled', label: 'مجدول' },
  { value: 'confirmed', label: 'مؤكد' },
  { value: 'completed', label: 'مكتمل' },
  { value: 'cancelled', label: 'ملغى' },
  { value: 'no-show', label: 'لم يحضر' },
]

function getErrorMessage(error: Error) {
  if (error.message.includes('permission-denied')) return 'لا تملك صلاحية تنفيذ هذا الإجراء.'
  if (error.message.includes('unavailable')) return 'تعذر الاتصال بقاعدة البيانات. حاول مجددًا.'
  return 'تعذر تحميل المواعيد. حاول مجددًا.'
}

function toDate(value: unknown) {
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') return value.toDate() as Date
  if (typeof value === 'string' || value instanceof Date) return new Date(value)
  return null
}

function formatDate(value: unknown) {
  const date = toDate(value)
  return date ? date.toLocaleDateString('ar-SA') : '—'
}

function formatDateTime(value: unknown) {
  const date = toDate(value)
  return date ? date.toLocaleString('ar-SA', { dateStyle: 'medium', timeStyle: 'short' }) : '—'
}

function dateInputValue(value: unknown) {
  const date = toDate(value)
  if (!date) return ''
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function statusLabel(status: string) {
  return appointmentStatuses.find((item) => item.value === status)?.label ?? status
}

function statusTone(status: string) {
  return status === 'confirmed' || status === 'completed' ? 'success' as const : status === 'scheduled' ? 'pending' as const : 'neutral' as const
}

export function AppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [clinics, setClinics] = useState<Clinic[]>([])
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [patients, setPatients] = useState<Patient[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [search, setSearch] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [organizationFilter, setOrganizationFilter] = useState('all')
  const [clinicFilter, setClinicFilter] = useState('all')
  const [doctorFilter, setDoctorFilter] = useState('all')
  const [patientFilter, setPatientFilter] = useState('all')
  const [viewing, setViewing] = useState<Appointment | null>(null)
  const [statusEdit, setStatusEdit] = useState<Appointment['status']>('scheduled')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    const unsubscribeAppointments = subscribeToCollection<Appointment>('appointments', (records) => { setAppointments(records); setIsLoading(false); setError('') }, (subscriptionError) => { setIsLoading(false); setError(getErrorMessage(subscriptionError)) })
    const unsubscribeOrganizations = subscribeToCollection<Organization>('organizations', setOrganizations, (subscriptionError) => setError(getErrorMessage(subscriptionError)))
    const unsubscribeClinics = subscribeToCollection<Clinic>('clinics', setClinics, (subscriptionError) => setError(getErrorMessage(subscriptionError)))
    const unsubscribeDoctors = subscribeToCollection<Doctor>('doctors', setDoctors, (subscriptionError) => setError(getErrorMessage(subscriptionError)))
    const unsubscribePatients = subscribeToCollection<Patient>('patients', setPatients, (subscriptionError) => setError(getErrorMessage(subscriptionError)))
    return () => { unsubscribeAppointments(); unsubscribeOrganizations(); unsubscribeClinics(); unsubscribeDoctors(); unsubscribePatients() }
  }, [])

  const organizationNames = useMemo(() => new Map(organizations.map((organization) => [organization.id, organization.name])), [organizations])
  const clinicNames = useMemo(() => new Map(clinics.map((clinic) => [clinic.id, clinic.name])), [clinics])
  const doctorNames = useMemo(() => new Map(doctors.map((doctor) => [doctor.id, doctor.name])), [doctors])
  const patientNames = useMemo(() => new Map(patients.map((patient) => [patient.id, patient.name])), [patients])
  const filteredAppointments = useMemo(() => appointments.filter((appointment) => {
    const appointmentDate = toDate(appointment.date)
    const searchable = `${patientNames.get(appointment.patientId) ?? ''} ${doctorNames.get(appointment.doctorId) ?? ''} ${organizationNames.get(appointment.organizationId) ?? ''} ${clinicNames.get(appointment.clinicId) ?? ''}`.toLowerCase()
    return searchable.includes(search.toLowerCase()) && (!dateFilter || dateInputValue(appointment.date) === dateFilter) && (statusFilter === 'all' || appointment.status === statusFilter) && (organizationFilter === 'all' || appointment.organizationId === organizationFilter) && (clinicFilter === 'all' || appointment.clinicId === clinicFilter) && (doctorFilter === 'all' || appointment.doctorId === doctorFilter) && (patientFilter === 'all' || appointment.patientId === patientFilter) && (!dateFilter || appointmentDate !== null)
  }).sort((first, second) => (toDate(first.date)?.getTime() ?? 0) - (toDate(second.date)?.getTime() ?? 0)), [appointments, patientNames, doctorNames, organizationNames, clinicNames, search, dateFilter, statusFilter, organizationFilter, clinicFilter, doctorFilter, patientFilter])

  const openDetails = (appointment: Appointment) => { setViewing(appointment); setStatusEdit(appointment.status) }

  const handleStatusUpdate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!viewing) return
    setIsSaving(true); setError('')
    try { await updateRecord('appointments', viewing.id, { status: statusEdit }); setViewing(null); setNotice('تم تحديث حالة الموعد بنجاح.'); window.setTimeout(() => setNotice(''), 3500) } catch (saveError) { setError(getErrorMessage(saveError instanceof Error ? saveError : new Error())) } finally { setIsSaving(false) }
  }

  return <><Breadcrumbs current="المواعيد" /><PageHeader title="المواعيد" description="تابع جدول المواعيد والتنسيق بين فرق الرعاية." /><div className="appointment-toolbar"><DataToolbar searchLabel="البحث باسم الطبيب أو المريض" searchValue={search} onSearch={setSearch} filterValue={statusFilter} onFilterChange={setStatusFilter} filterOptions={[{ value: 'all', label: 'كل الحالات' }, ...appointmentStatuses]} /></div><div className="appointment-filters"><label><span>التاريخ</span><input type="date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} /></label><label><span>المؤسسة</span><select value={organizationFilter} onChange={(event) => setOrganizationFilter(event.target.value)}><option value="all">كل المؤسسات</option>{organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}</select></label><label><span>العيادة</span><select value={clinicFilter} onChange={(event) => setClinicFilter(event.target.value)}><option value="all">كل العيادات</option>{clinics.map((clinic) => <option key={clinic.id} value={clinic.id}>{clinic.name}</option>)}</select></label><label><span>الطبيب</span><select value={doctorFilter} onChange={(event) => setDoctorFilter(event.target.value)}><option value="all">كل الأطباء</option>{doctors.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.name}</option>)}</select></label><label><span>المريض</span><select value={patientFilter} onChange={(event) => setPatientFilter(event.target.value)}><option value="all">كل المرضى</option>{patients.map((patient) => <option key={patient.id} value={patient.id}>{patient.name}</option>)}</select></label></div>{notice && <p className="success-message" role="status">{notice}</p>}{error && <div className="data-feedback error-state" role="alert">{error}</div>}{!isLoading && !error && appointments.length > 0 && <p className="success-message" role="status">تم تحميل المواعيد بنجاح.</p>}{isLoading ? <div className="data-feedback" role="status">جارٍ تحميل المواعيد...</div> : !error && filteredAppointments.length === 0 ? <div className="data-feedback empty-state-inline"><strong>{appointments.length === 0 ? 'لا توجد مواعيد مجدولة' : 'لا توجد نتائج مطابقة'}</strong><span>{appointments.length === 0 ? 'ستظهر المواعيد هنا عند ربطها بقاعدة البيانات.' : 'جرّب تغيير المرشحات.'}</span></div> : !error && <div className="table-card"><div className="table-scroll"><table><thead><tr><th>التاريخ والوقت</th><th>المؤسسة</th><th>العيادة</th><th>الطبيب</th><th>المريض</th><th>الحالة</th><th>الإجراءات</th></tr></thead><tbody>{filteredAppointments.map((appointment) => <tr key={appointment.id}><td className="table-primary">{formatDateTime(appointment.date)}</td><td>{organizationNames.get(appointment.organizationId) ?? 'مؤسسة غير موجودة'}</td><td>{clinicNames.get(appointment.clinicId) ?? 'عيادة غير موجودة'}</td><td>{doctorNames.get(appointment.doctorId) ?? 'طبيب غير موجود'}</td><td>{patientNames.get(appointment.patientId) ?? 'مريض غير موجود'}</td><td><StatusBadge label={statusLabel(appointment.status)} tone={statusTone(appointment.status)} /></td><td><button type="button" className="icon-button table-action" onClick={() => openDetails(appointment)} aria-label="عرض تفاصيل الموعد"><Eye size={16} /></button></td></tr>)}</tbody></table></div></div>}{viewing && <Modal title="تفاصيل الموعد" description={formatDateTime(viewing.date)} onClose={() => setViewing(null)} onSubmit={handleStatusUpdate} submitLabel={isSaving ? 'جارٍ الحفظ...' : 'حفظ الحالة'}><div className="details-grid"><div><span>المريض</span><strong>{patientNames.get(viewing.patientId) ?? 'مريض غير موجود'}</strong></div><div><span>الطبيب</span><strong>{doctorNames.get(viewing.doctorId) ?? 'طبيب غير موجود'}</strong></div><div><span>المؤسسة</span><strong>{organizationNames.get(viewing.organizationId) ?? 'مؤسسة غير موجودة'}</strong></div><div><span>العيادة</span><strong>{clinicNames.get(viewing.clinicId) ?? 'عيادة غير موجودة'}</strong></div><label className="field field-full"><span>حالة الموعد</span><select value={statusEdit} onChange={(event) => setStatusEdit(event.target.value as Appointment['status'])}>{appointmentStatuses.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}</select></label><div className="field-full"><span>ملاحظات الموعد</span><strong>{viewing.notes || 'لا توجد ملاحظات.'}</strong></div></div></Modal>}</>
}