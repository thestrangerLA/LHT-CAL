import { Timestamp } from 'firebase/firestore';

export type Currency = 'USD' | 'THB' | 'LAK' | 'CNY';

export type DateValue = string | undefined | null | Timestamp;

export interface Room {
    id: string;
    date?: DateValue;
    type: string;
    numRooms: number;
    numNights: number;
    price: number;
    currency: Currency;
}

export interface Accommodation {
    id: string;
    name: string;
    type: 'hotel' | 'guesthouse';
    checkInDate?: DateValue;
    rooms: Room[];
}

export interface Trip {
    id: string;
    date?: DateValue;
    location: string;
    route: string;
    vehicleType: string;
    numVehicles: number;
    numDays: number;
    pricePerVehicle: number;
    currency: Currency;
}

export interface Flight {
    id: string;
    from: string;
    to: string;
    departureDate?: DateValue;
    departureTime: string;
    pricePerPerson: number;
    numPeople: number;
    currency: Currency;
}

export interface TrainTicket {
    id: string;
    from: string;
    to: string;
    departureDate?: DateValue;
    departureTime: string;
    ticketClass: string;
    numTickets: number;
    pricePerTicket: number;
    currency: Currency;
}

export interface EntranceFee {
    id: string;
    date?: DateValue;
    locationName: string;
    pax: number;
    numLocations: number;
    price: number;
    currency: Currency;
}

export interface MealCost {
    id: string;
    date?: DateValue;
    name: string;
    pax: number;
    breakfast: number;
    lunch: number;
    dinner: number;
    pricePerMeal: number;
    currency: Currency;
}

export interface GuideFee {
    id: string;
    date?: DateValue;
    guideName: string;
    numGuides: number;
    numDays: number;
    pricePerDay: number;
    currency: Currency;
}

export interface DocumentFee {
    id: string;
    date?: DateValue;
    documentName: string;
    pax: number;
    price: number;
    currency: Currency;
}

export interface OverseasPackage {
    id: string;
    date?: DateValue;
    name: string;
    price: number;
    currency: Currency;
}

export interface Activity {
    id: string;
    date?: DateValue;
    name: string;
    pax: number;
    price: number;
    currency: Currency;
}

export interface TourInfo {
    mouContact: string;
    groupCode: string;
    destinationCountry: string;
    program: string;
    startDate?: DateValue;
    endDate?: DateValue;
    numDays: number;
    numNights: number;
    numPeople: number;
    travelerInfo: string;
}

export interface TourCosts {
    accommodations: Accommodation[];
    trips: Trip[];
    flights: Flight[];
    trainTickets: TrainTicket[];
    entranceFees: EntranceFee[];
    meals: MealCost[];
    guides: GuideFee[];
    documents: DocumentFee[];
    overseasPackages: OverseasPackage[];
    activities: Activity[];
}

export interface ExchangeRates {
    USD: Record<Currency, number>;
    THB: Record<Currency, number>;
    CNY: Record<Currency, number>;
    LAK: Record<Currency, number>;
}

export interface SavedCalculation {
    id: string;
    uid: string;
    name: string;
    days: number;
    markupPercentage: number;
    markupAmount: number;
    createdAt: DateValue;
    exchangeRates: ExchangeRates;
    costs: TourCosts;
    allCosts?: TourCosts; // Legacy support
    tourInfo?: TourInfo; // Keep for backward compatibility or extra info
    savedAt?: DateValue; // Legacy support
}
