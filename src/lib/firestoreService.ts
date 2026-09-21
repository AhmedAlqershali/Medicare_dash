import { addDoc, collection, doc, onSnapshot, serverTimestamp, updateDoc, type DocumentData, type Unsubscribe } from 'firebase/firestore'
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