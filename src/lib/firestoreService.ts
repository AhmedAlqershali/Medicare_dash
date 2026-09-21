import { addDoc, collection, doc, getDocs, onSnapshot, query, serverTimestamp, updateDoc, where, writeBatch, type DocumentData, type Unsubscribe } from 'firebase/firestore'
import { db } from './firebase'

export type FirestoreRecord = DocumentData & { id: string }

export function subscribeToCollection<T extends FirestoreRecord>(collectionName: string, onData: (records: T[]) => void, onError: (error: Error) => void): Unsubscribe {
  return onSnapshot(collection(db, collectionName), (snapshot) => {
    onData(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as T))
  }, onError)
}

export function addRecord(collectionName: string, data: DocumentData, createdBy: string) {
  return addDoc(collection(db, collectionName), { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp(), createdBy })
}

export function updateRecord(collectionName: string, id: string, data: DocumentData) {
  return updateDoc(doc(db, collectionName, id), { ...data, updatedAt: serverTimestamp() })
}

export async function deleteOrganizationCascade(organizationId: string) {
  const relatedCollections = ['clinics', 'doctors', 'patients', 'appointments', 'invitations']
  const relatedReferences = (await Promise.all(relatedCollections.map(async (collectionName) => {
    const snapshot = await getDocs(query(collection(db, collectionName), where('organizationId', '==', organizationId)))
    return snapshot.docs.map((item) => item.ref)
  }))).flat()
  const references = [...relatedReferences, doc(db, 'organizations', organizationId)]

  for (let index = 0; index < references.length; index += 500) {
    const batch = writeBatch(db)
    references.slice(index, index + 500).forEach((reference) => batch.delete(reference))
    await batch.commit()
  }
}