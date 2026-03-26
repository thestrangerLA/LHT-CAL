import { Timestamp } from 'firebase/firestore';

export function toDateSafe(date: any): Date | null {
    if (!date) return null;
    if (date instanceof Timestamp) {
        return date.toDate();
    }
    if (typeof date === 'string' || typeof date === 'number') {
        const parsedDate = new Date(date);
        return isNaN(parsedDate.getTime()) ? null : parsedDate;
    }
    if (date instanceof Date) {
        return date;
    }
    if (date && typeof date === 'object' && 'seconds' in date && 'nanoseconds' in date) {
        return new Timestamp(date.seconds, date.nanoseconds).toDate();
    }
    return null;
}
