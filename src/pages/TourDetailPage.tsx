import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { ArrowLeft, ArrowRight, Save, Trash2, MapPin, Calendar as CalendarIcon, BedDouble, Truck, Plane, TrainFront, PlusCircle, Camera, UtensilsCrossed, Users, FileText, Clock, Eye, EyeOff, Printer, Earth, Bike, Calculator, LogOut, User, Globe } from "lucide-react";
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import { TotalCostCard } from '@/components/tour/TotalCostCard';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ExchangeRateCard } from '@/components/tour/ExchangeRateCard';
import { doc, setDoc, serverTimestamp, deleteDoc, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase';
import { toDateSafe } from '@/lib/timestamp';
import { useAuth } from '@/contexts/AuthContext';
import { 
    Currency, 
    TourInfo, 
    TourCosts, 
    SavedCalculation, 
    ExchangeRates, 
    Accommodation, 
    Room, 
    Trip, 
    Flight, 
    TrainTicket, 
    EntranceFee, 
    MealCost, 
    GuideFee, 
    DocumentFee, 
    OverseasPackage, 
    Activity 
} from '@/types';

const currencySymbols: Record<Currency, string> = {
    USD: '$ (ດອນລ່າ)',
    THB: '฿ (ບາດ)',
    LAK: '₭ (ກີບ)',
    CNY: '¥ (ຢວນ)',
};

const formatNumber = (num: number) => new Intl.NumberFormat('en-US').format(num);

const initialRates: ExchangeRates = {
    USD: { THB: 38, LAK: 25000, CNY: 8, USD: 1 },
    THB: { USD: 0.032, LAK: 700, CNY: 0.25, THB: 1 },
    CNY: { USD: 0.20, THB: 6, LAK: 3500, CNY: 1 },
    LAK: { USD: 0.00005, THB: 0.0015, CNY: 0.00035, LAK: 1 },
};

const CostCategoryContent = ({ title, icon, children, summary }: { title: string, icon: React.ReactNode, children: React.ReactNode, summary: React.ReactNode }) => (
     <AccordionItem value={title.toLowerCase().replace(/\s/g, '-')} className="bg-card px-8 py-3 rounded-2xl border-none shadow-soft mb-6 overflow-hidden transition-all hover:shadow-md">
        <AccordionTrigger className="text-xl font-black py-5 hover:no-underline group">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300 shadow-sm">
                {icon}
            </div>
            <span className="tracking-tight">{title}</span>
          </div>
        </AccordionTrigger>
        <AccordionContent className="pt-4 pb-8">
            <div className="space-y-8">
                {children}
                <div className="pt-6 border-t border-dashed">
                    {summary}
                </div>
            </div>
        </AccordionContent>
    </AccordionItem>
);

export default function TourDetailPage() {
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const { id: calculationId } = useParams<{ id: string }>();
    
    const [tourInfo, setTourInfo] = useState<TourInfo>({
        mouContact: '', groupCode: '', destinationCountry: '', program: '',
        numDays: 1, numNights: 0, numPeople: 1, travelerInfo: ''
    });

    const [allCosts, setAllCosts] = useState<TourCosts>({
        accommodations: [], trips: [], flights: [], trainTickets: [],
        entranceFees: [], meals: [], guides: [], documents: [], overseasPackages: [], activities: []
    });

    const [exchangeRates, setExchangeRates] = useState<ExchangeRates>(initialRates);
    const [profitPercentage, setProfitPercentage] = useState<number>(20);
    const [itemVisibility, setItemVisibility] = useState<Record<string, boolean>>({});
    const [activeTab, setActiveTab] = useState('info');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!calculationId || !user) return;

        const docRef = doc(db, 'tours', calculationId);
        const unsubscribe = onSnapshot(docRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.data() as SavedCalculation & { uid: string };
                
                // Security check: ensure user owns this doc
                if (data.uid !== user.uid) {
                    toast.error("You do not have permission to view this calculation.");
                    navigate('/tour/cost-calculator');
                    return;
                }

                setTourInfo(data.tourInfo || {
                    mouContact: '', groupCode: '', destinationCountry: '', program: '',
                    numDays: 1, numNights: 0, numPeople: 1, travelerInfo: ''
                });
                setAllCosts({
                    accommodations: [], trips: [], flights: [], trainTickets: [],
                    entranceFees: [], meals: [], guides: [], documents: [], overseasPackages: [], activities: [],
                    ...(data.allCosts || {})
                });
                if (data.exchangeRates) setExchangeRates(data.exchangeRates);
                if (data.profitPercentage !== undefined) setProfitPercentage(data.profitPercentage);
                setLoading(false);
            } else {
                toast.error("Calculation not found.");
                navigate('/tour/cost-calculator');
            }
        }, (error) => {
            handleFirestoreError(error, OperationType.GET, `tours/${calculationId}`);
        });

        return () => unsubscribe();
    }, [calculationId, navigate, user]);

    const updateCosts = useCallback((category: keyof TourCosts, data: any[]) => {
        setAllCosts(prev => ({ ...prev, [category]: data }));
    }, []);

    const handleSaveCalculation = async () => {
        if (!calculationId || !user) return;
        
        const docRef = doc(db, 'tours', calculationId);
        const dataToSave = {
            uid: user.uid,
            tourInfo: JSON.parse(JSON.stringify(tourInfo)),
            allCosts: JSON.parse(JSON.stringify(allCosts)),
            exchangeRates: JSON.parse(JSON.stringify(exchangeRates)),
            profitPercentage: profitPercentage,
            savedAt: serverTimestamp(),
        };

        try {
            await setDoc(docRef, dataToSave, { merge: true });
            toast.success("ບັນທຶກການຄຳນວນສຳເລັດ");
        } catch (error) {
            handleFirestoreError(error, OperationType.WRITE, `tours/${calculationId}`);
        }
    };
    
    const handleDeleteCalculation = async () => {
        if (!calculationId || !user) return;
        if (window.confirm("ທ່ານແນ່ໃຈບໍ່ວ່າຕ້ອງການລຶບຂໍ້ມູນການຄຳນວນນີ້?")) {
            try {
                const docRef = doc(db, 'tours', calculationId);
                await deleteDoc(docRef);
                navigate('/tour/cost-calculator');
                toast.success("ລຶບຂໍ້ມູນສຳເລັດ");
            } catch (error) {
                handleFirestoreError(error, OperationType.DELETE, `tours/${calculationId}`);
            }
        }
    };

    const toggleItemVisibility = (itemId: string) => {
        setItemVisibility(prev => ({ ...prev, [itemId]: !prev[itemId] }));
    };

    const addItem = <T extends keyof TourCosts>(category: T, newItem: any) => {
        const currentItems = allCosts[category] as any[] || [];
        updateCosts(category, [...currentItems, newItem]);
    };

    const updateItem = <T extends keyof TourCosts>(category: T, itemId: string, field: string, value: any) => {
        const currentItems = allCosts[category] as any[];
        const updatedItems = currentItems.map(item => item.id === itemId ? { ...item, [field]: value } : item);
        updateCosts(category, updatedItems as TourCosts[T]);
    };
    
    const deleteItem = <T extends keyof TourCosts>(category: T, itemId: string) => {
        const updatedItems = (allCosts[category] || []).filter((item: any) => item.id !== itemId);
        updateCosts(category, updatedItems as TourCosts[T]);
    };

    // Specific Adders
    const addAccommodation = () => addItem('accommodations', { id: uuidv4(), name: '', type: 'hotel', rooms: [{ id: uuidv4(), type: 'ຕຽງດ່ຽວ', numRooms: 1, numNights: 1, price: 0, currency: 'USD' }] });
    const addRoom = (accId: string) => {
        const accommodations = allCosts.accommodations.map(acc => {
            if (acc.id === accId) {
                const newRoom = { id: uuidv4(), type: 'ຕຽງດ່ຽວ', numRooms: 1, numNights: 1, price: 0, currency: 'USD' };
                return { ...acc, rooms: [...acc.rooms, newRoom] };
            }
            return acc;
        });
        updateCosts('accommodations', accommodations);
    };
    const updateRoom = (accId: string, roomId: string, field: keyof Room, value: any) => {
         const accommodations = allCosts.accommodations.map(acc => {
            if (acc.id === accId) {
                const updatedRooms = acc.rooms.map(room => room.id === roomId ? { ...room, [field]: value } : room);
                return { ...acc, rooms: updatedRooms };
            }
            return acc;
        });
        updateCosts('accommodations', accommodations);
    };
    const deleteRoom = (accId: string, roomId: string) => {
         const accommodations = allCosts.accommodations.map(acc => {
            if (acc.id === accId) {
                return { ...acc, rooms: acc.rooms.filter(room => room.id !== roomId) };
            }
            return acc;
        });
        updateCosts('accommodations', accommodations);
    };

    const addTrip = () => addItem('trips', { id: uuidv4(), date: undefined, location: '', route: '', vehicleType: 'ລົດຕູ້ທຳມະດາ', numVehicles: 1, numDays: 1, pricePerVehicle: 0, currency: 'USD' });
    const addFlight = () => addItem('flights', { id: uuidv4(), from: '', to: '', departureDate: undefined, departureTime: '08:00', pricePerPerson: 0, numPeople: 1, currency: 'USD' });
    const addTrainTicket = () => addItem('trainTickets', { id: uuidv4(), from: '', to: '', departureDate: undefined, departureTime: '08:00', ticketClass: '', numTickets: 1, pricePerTicket: 0, currency: 'LAK' });
    const addEntranceFee = () => addItem('entranceFees', { id: uuidv4(), date: undefined, locationName: '', pax: 1, numLocations: 1, price: 0, currency: 'LAK' });
    const addMealCost = () => addItem('meals', { id: uuidv4(), date: undefined, name: '', pax: 1, breakfast: 0, lunch: 0, dinner: 0, pricePerMeal: 0, currency: 'LAK' });
    const addGuideFee = () => addItem('guides', { id: uuidv4(), date: undefined, guideName: '', numGuides: 1, numDays: 1, pricePerDay: 0, currency: 'LAK' });
    const addDocumentFee = () => addItem('documents', { id: uuidv4(), date: undefined, documentName: '', pax: 1, price: 0, currency: 'LAK' });
    const addOverseasPackage = () => addItem('overseasPackages', { id: uuidv4(), date: undefined, name: '', priceUSD: 0, priceTHB: 0, priceCNY: 0 });
    const addActivity = () => addItem('activities', { id: uuidv4(), date: undefined, name: '', pax: 1, price: 0, currency: 'LAK' });

    // --- Totals ---
    const accommodationTotals = useMemo(() => {
        const totals: Record<Currency, number> = { USD: 0, THB: 0, LAK: 0, CNY: 0 };
        allCosts.accommodations?.forEach(acc => {
            acc.rooms.forEach(room => {
                totals[room.currency] += (room.numRooms || 0) * (room.numNights || 0) * (room.price || 0);
            });
        });
        return totals;
    }, [allCosts.accommodations]);

    const tripTotals = useMemo(() => {
        const totals: Record<Currency, number> = { USD: 0, THB: 0, LAK: 0, CNY: 0 };
        allCosts.trips?.forEach(trip => {
            totals[trip.currency] += (trip.numVehicles || 0) * (trip.numDays || 0) * (trip.pricePerVehicle || 0);
        });
        return totals;
    }, [allCosts.trips]);

    const flightTotals = useMemo(() => {
        const totals: Record<Currency, number> = { USD: 0, THB: 0, LAK: 0, CNY: 0 };
        allCosts.flights?.forEach(flight => {
            totals[flight.currency] += (flight.pricePerPerson || 0) * (flight.numPeople || 0);
        });
        return totals;
    }, [allCosts.flights]);
    
    const trainTotals = useMemo(() => {
        const totals: Record<Currency, number> = { USD: 0, THB: 0, LAK: 0, CNY: 0 };
        allCosts.trainTickets?.forEach(ticket => {
            totals[ticket.currency] += (ticket.pricePerTicket || 0) * (ticket.numTickets || 0);
        });
        return totals;
    }, [allCosts.trainTickets]);

    const entranceFeeTotals = useMemo(() => {
        const totals: Record<Currency, number> = { USD: 0, THB: 0, LAK: 0, CNY: 0 };
        allCosts.entranceFees?.forEach(fee => {
            totals[fee.currency] += (fee.pax || 0) * (fee.numLocations || 0) * (fee.price || 0);
        });
        return totals;
    }, [allCosts.entranceFees]);

    const mealTotals = useMemo(() => {
        const totals: Record<Currency, number> = { USD: 0, THB: 0, LAK: 0, CNY: 0 };
        allCosts.meals?.forEach(meal => {
            totals[meal.currency] += ((meal.breakfast || 0) + (meal.lunch || 0) + (meal.dinner || 0)) * (meal.pricePerMeal || 0) * (meal.pax || 0);
        });
        return totals;
    }, [allCosts.meals]);

    const guideTotals = useMemo(() => {
        const totals: Record<Currency, number> = { USD: 0, THB: 0, LAK: 0, CNY: 0 };
        allCosts.guides?.forEach(guide => {
            totals[guide.currency] += (guide.numGuides || 0) * (guide.numDays || 0) * (guide.pricePerDay || 0);
        });
        return totals;
    }, [allCosts.guides]);

    const documentTotals = useMemo(() => {
        const totals: Record<Currency, number> = { USD: 0, THB: 0, LAK: 0, CNY: 0 };
        allCosts.documents?.forEach(doc => {
            totals[doc.currency] += (doc.pax || 0) * (doc.price || 0);
        });
        return totals;
    }, [allCosts.documents]);

    const overseasPackageTotals = useMemo(() => {
        const totals: Record<Currency, number> = { USD: 0, THB: 0, LAK: 0, CNY: 0 };
        allCosts.overseasPackages?.forEach(pkg => {
            totals.USD += pkg.priceUSD || 0;
            totals.THB += pkg.priceTHB || 0;
            totals.CNY += pkg.priceCNY || 0;
        });
        return totals;
    }, [allCosts.overseasPackages]);
    
    const activityTotals = useMemo(() => {
        const totals: Record<Currency, number> = { USD: 0, THB: 0, LAK: 0, CNY: 0 };
        allCosts.activities?.forEach(activity => {
            totals[activity.currency] += (activity.pax || 0) * (activity.price || 0);
        });
        return totals;
    }, [allCosts.activities]);

    const totalsByCategory = {
        'ຄ່າທີ່ພັກ': accommodationTotals,
        'ຄ່າຂົນສົ່ງ': tripTotals,
        'ຄ່າປີ້ຍົນ': flightTotals,
        'ຄ່າປີ້ລົດໄຟ': trainTotals,
        'ຄ່າເຂົ້າຊົມສະຖານທີ່': entranceFeeTotals,
        'ຄ່າອາຫານ': mealTotals,
        'ຄ່າໄກ້': guideTotals,
        'ຄ່າເອກະສານ': documentTotals,
        'ຄ່າເພັກເກດຕ່າງປະເທດ': overseasPackageTotals,
        'ຄ່າກິດຈະກຳ': activityTotals,
    };

    const grandTotals = useMemo(() => {
        const totals: Record<Currency, number> = { USD: 0, THB: 0, LAK: 0, CNY: 0 };
        Object.values(totalsByCategory).forEach(categoryTotals => {
            (Object.keys(totals) as Currency[]).forEach(currency => {
                totals[currency] += categoryTotals[currency];
            });
        });
        return totals;
    }, [totalsByCategory]);

    const CategorySummary = ({ totals }: { totals: Record<Currency, number> }) => {
        const filteredTotals = Object.entries(totals).filter(([, value]) => value > 0);
        if (filteredTotals.length === 0) return null;

        return (
            <div className="mt-6 rounded-2xl bg-primary/5 p-5 border border-primary/10">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/90 mb-3">ສະຫຼຸບຍອດໝວດນີ້:</p>
                <div className="flex flex-wrap items-center gap-6">
                    {filteredTotals.map(([currency, value]) => (
                        <div key={currency} className="flex items-baseline gap-2">
                            <span className="text-xs font-black text-primary/70">{currency}</span>
                            <span className="text-xl font-black tracking-tight text-primary">{formatNumber(value)}</span>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    if (loading) {
        return <div className="flex items-center justify-center h-screen">Loading...</div>;
    }

    const startDate = toDateSafe(tourInfo.startDate);
    const endDate = toDateSafe(tourInfo.endDate);

    return (
        <div className="flex min-h-screen w-full flex-col bg-muted/30">
            <header className="sticky top-0 z-50 flex h-20 items-center gap-4 border-b bg-background/60 px-6 backdrop-blur-xl sm:px-10 print:hidden">
                <Button variant="ghost" size="icon" className="h-12 w-12 rounded-full hover:bg-muted/50 transition-all active:scale-95" asChild>
                    <Link to="/tour/cost-calculator">
                        <ArrowLeft className="h-6 w-6" />
                        <span className="sr-only">ກັບໄປໜ້າລາຍການ</span>
                    </Link>
                </Button>
                <div className="flex-1">
                    <h1 className="text-2xl font-black tracking-tighter flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-xl">
                            <Calculator className="h-6 w-6 text-primary"/>
                        </div>
                        ລະບົບຄຳນວນຄ່າໃຊ້ຈ່າຍທົວ
                    </h1>
                </div>
                 <div className="flex items-center gap-3">
                    <Button variant="outline" size="lg" className="hidden sm:flex rounded-full px-6 font-bold border-2 hover:bg-muted/50 transition-all" onClick={() => window.print()}>
                        <Printer className="mr-2 h-5 w-5" />
                        ພິມ
                    </Button>
                    <Button variant="ghost" size="lg" className="hidden sm:flex rounded-full px-6 font-bold text-destructive hover:bg-destructive/10 transition-all" onClick={handleDeleteCalculation}>
                        <Trash2 className="mr-2 h-5 w-5" />
                        ລຶບ
                    </Button>
                    <Button size="lg" onClick={handleSaveCalculation} className="rounded-full px-8 font-bold shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all active:scale-95">
                        <Save className="mr-2 h-5 w-5" />
                        ບັນທຶກຂໍ້ມູນ
                    </Button>
                    <div className="h-8 w-px bg-muted mx-2" />
                    <Button variant="ghost" size="icon" onClick={logout} className="h-12 w-12 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all">
                        <LogOut className="h-5 w-5" />
                    </Button>
                </div>
            </header>

            <main className="flex w-full flex-1 flex-col gap-8 p-6 sm:px-10 sm:py-12 bg-[#F8F9FB] print:p-0 print:bg-white">
                <div className="w-full max-w-screen-2xl mx-auto">
                    <div className="w-full max-w-5xl mx-auto">
                        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                            <TabsList className="grid w-full grid-cols-5 h-14 bg-white/80 backdrop-blur-md rounded-2xl p-1 shadow-soft mb-6 border border-white/20 print:hidden">
                                <TabsTrigger value="info" className="rounded-xl font-black text-[10px] sm:text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg transition-all">
                                    1. ຂໍ້ມູນພື້ນຖານ
                                </TabsTrigger>
                                <TabsTrigger value="costs" className="rounded-xl font-black text-[10px] sm:text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg transition-all">
                                    2. ຄ່າໃຊ້ຈ່າຍຕ່າງໆ
                                </TabsTrigger>
                                <TabsTrigger value="grand_totals" className="rounded-xl font-black text-[10px] sm:text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg transition-all">
                                    3. ລວມຍອດຕົ້ນທຶນ
                                </TabsTrigger>
                                <TabsTrigger value="category_totals" className="rounded-xl font-black text-[10px] sm:text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg transition-all">
                                    4. ລາຍລະອຽດຕົ້ນທຶນ
                                </TabsTrigger>
                                <TabsTrigger value="calculation_summary" className="rounded-xl font-black text-[10px] sm:text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg transition-all">
                                    5. ສະຫຼຸບການຄຳນວນ
                                </TabsTrigger>
                            </TabsList>

                            <div id="print-content" className="space-y-10">
                                <TabsContent value="info" className="space-y-10 mt-0 outline-none">
                                    {/* Tour Info Section */}
                         <Card className="border-none shadow-soft rounded-[2rem] bg-white overflow-hidden print:shadow-none print:border">
                            <CardHeader className="pb-4 pt-6 px-8 border-b bg-muted/5 print:p-4">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-1">
                                        <CardTitle className="flex items-center gap-4 text-2xl font-black tracking-tight print:text-lg">
                                            <div className="p-2 bg-primary text-primary-foreground rounded-xl shadow-lg shadow-primary/20">
                                                <MapPin className="h-5 w-5" />
                                            </div>
                                            ຂໍ້ມູນພື້ນຖານຂອງທົວ
                                        </CardTitle>
                                        <CardDescription className="text-sm font-medium text-muted-foreground/80">ກະລຸນາລະບຸຂໍ້ມູນເບື້ອງຕົ້ນຂອງກຸ່ມນັກທ່ອງທ່ຽວ</CardDescription>
                                    </div>
                                    <div className="hidden md:flex items-center gap-3 px-4 py-2 rounded-xl bg-primary/5 border border-primary/10">
                                        <Users className="h-4 w-4 text-primary" />
                                        <span className="text-xs font-black text-primary">{tourInfo.numPeople} Travelers</span>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-8 space-y-8 print:p-4">
                                <div className="grid md:grid-cols-3 gap-8 print:grid-cols-2 print:gap-4">
                                    <div className="space-y-3">
                                        <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground ml-1">MOU Contact</Label>
                                        <div className="relative group">
                                            <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40 group-focus-within:text-primary transition-colors" />
                                            <Input placeholder="ຊື່ຜູ້ຕິດຕໍ່" value={tourInfo.mouContact} onChange={e => setTourInfo({...tourInfo, mouContact: e.target.value})} className="h-14 pl-12 bg-muted/30 border-transparent focus:bg-white focus:ring-4 focus:ring-primary/5 transition-all rounded-2xl font-bold" />
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground ml-1">Group Code</Label>
                                        <div className="relative group">
                                            <FileText className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40 group-focus-within:text-primary transition-colors" />
                                            <Input placeholder="ລະຫັດກຸ່ມ" value={tourInfo.groupCode} onChange={e => setTourInfo({...tourInfo, groupCode: e.target.value})} className="h-14 pl-12 bg-muted/30 border-transparent focus:bg-white focus:ring-4 focus:ring-primary/5 transition-all rounded-2xl font-black text-primary" />
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground ml-1">ປະເທດປາຍທາງ</Label>
                                        <div className="relative group">
                                            <Globe className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40 group-focus-within:text-primary transition-colors" />
                                            <Input placeholder="ປະເທດປາຍທາງ" value={tourInfo.destinationCountry} onChange={e => setTourInfo({...tourInfo, destinationCountry: e.target.value})} className="h-14 pl-12 bg-muted/30 border-transparent focus:bg-white focus:ring-4 focus:ring-primary/5 transition-all rounded-2xl font-bold" />
                                        </div>
                                    </div>

                                    <div className="h-px bg-muted/50 my-2 md:col-span-3" />

                                    <div className="space-y-3 md:col-span-2">
                                        <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground ml-1">ໂປຣແກຣມທົວ</Label>
                                        <Input placeholder="ລະບຸຊື່ໂປຣແກຣມ ຫຼື ເສັ້ນທາງ" value={tourInfo.program} onChange={e => setTourInfo({...tourInfo, program: e.target.value})} className="h-14 bg-muted/30 border-transparent focus:bg-white focus:ring-4 focus:ring-primary/5 transition-all rounded-2xl font-bold" />
                                    </div>
                                    
                                    <div className="hidden md:block" />
                                    <div className="h-px bg-muted/50 my-2 md:col-span-3" />

                                    <div className="space-y-3">
                                        <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground ml-1">ໄລຍະເວລາ</Label>
                                        <div className="flex items-center gap-3">
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <Button variant={"outline"} className="h-14 flex-1 justify-start text-left font-bold bg-muted/30 border-transparent hover:bg-muted/50 rounded-2xl transition-all">
                                                        <CalendarIcon className="mr-3 h-5 w-5 text-primary" />
                                                        {startDate ? format(startDate, "dd/MM/yyyy") : <span>ເລີ່ມ</span>}
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-auto p-0 rounded-[2rem] overflow-hidden shadow-2xl border-none">
                                                    <Calendar mode="single" selected={startDate || undefined} onSelect={date => setTourInfo({...tourInfo, startDate: date?.toISOString()})} initialFocus locale={th} />
                                                </PopoverContent>
                                            </Popover>
                                            <div className="h-px w-4 bg-muted-foreground/20" />
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <Button variant={"outline"} className="h-14 flex-1 justify-start text-left font-bold bg-muted/30 border-transparent hover:bg-muted/50 rounded-2xl transition-all">
                                                        <CalendarIcon className="mr-3 h-5 w-5 text-primary" />
                                                        {endDate ? format(endDate, "dd/MM/yyyy") : <span>ສິ້ນສຸດ</span>}
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-auto p-0 rounded-[2rem] overflow-hidden shadow-2xl border-none">
                                                    <Calendar mode="single" selected={endDate || undefined} onSelect={date => setTourInfo({...tourInfo, endDate: date?.toISOString()})} initialFocus locale={th} />
                                                </PopoverContent>
                                            </Popover>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-6 md:col-span-2">
                                        <div className="space-y-3">
                                            <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground ml-1">ວັນ / ຄືນ</Label>
                                            <div className="flex gap-3">
                                                <div className="relative flex-1">
                                                    <Input type="number" value={tourInfo.numDays} onChange={e => setTourInfo({...tourInfo, numDays: Number(e.target.value) || 1})} className="h-14 bg-muted/30 border-transparent focus:bg-white focus:ring-4 focus:ring-primary/5 transition-all rounded-2xl text-center font-black text-lg" />
                                                    <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] font-black uppercase text-muted-foreground/40">Days</span>
                                                </div>
                                                <div className="relative flex-1">
                                                    <Input type="number" value={tourInfo.numNights} onChange={e => setTourInfo({...tourInfo, numNights: Number(e.target.value) || 0})} className="h-14 bg-muted/30 border-transparent focus:bg-white focus:ring-4 focus:ring-primary/5 transition-all rounded-2xl text-center font-black text-lg" />
                                                    <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] font-black uppercase text-muted-foreground/40">Nights</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="space-y-3">
                                            <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground ml-1">ຈຳນວນຄົນ</Label>
                                            <div className="relative">
                                                <Input type="number" value={tourInfo.numPeople} onChange={e => setTourInfo({...tourInfo, numPeople: Number(e.target.value) || 1})} className="h-14 bg-muted/30 border-transparent focus:bg-white focus:ring-4 focus:ring-primary/5 transition-all rounded-2xl text-center font-black text-lg text-primary" />
                                                <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] font-black uppercase text-muted-foreground/40">Pax</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="h-px bg-muted/50 my-2 md:col-span-3" />

                                    <div className="space-y-3 md:col-span-3">
                                        <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground ml-1">ຂໍ້ມູນເພີ່ມເຕີມ</Label>
                                        <Textarea placeholder="ຕົວຢ່າງ ກຸ່ມຄອບຄົວ, ຄູ່ຮັກ, ຄວາມຕ້ອງການພິເສດ..." className="min-h-[140px] bg-muted/30 border-transparent focus:bg-white focus:ring-4 focus:ring-primary/5 transition-all rounded-[2rem] p-6 font-medium leading-relaxed" value={tourInfo.travelerInfo} onChange={e => setTourInfo({...tourInfo, travelerInfo: e.target.value})} />
                                    </div>
                                </div>
                                <div className="flex justify-end pt-6 print:hidden">
                                    <Button onClick={() => setActiveTab('costs')} className="rounded-full px-6 h-10 font-black text-sm shadow-lg shadow-primary/20 hover:shadow-xl transition-all">
                                        ຕໍ່ໄປ: ປ້ອນຄ່າໃຊ້ຈ່າຍ
                                        <ArrowRight className="ml-2 h-4 w-4" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                        
                                </TabsContent>
                                
                                <TabsContent value="costs" className="space-y-10 mt-0 outline-none">
                                    {/* Costs Section */}
                                    <div className="print:block">
                            <Accordion type="multiple" className="w-full" defaultValue={['ຄ່າທີ່ພັກ', 'ຄ່າຂົນສົ່ງ', 'ຄ່າປີ້ຍົນ', 'ຄ່າປີ້ລົດໄຟ', 'ຄ່າເຂົ້າຊົມສະຖານທີ່', 'ຄ່າອາຫານ', 'ຄ່າໄກ້', 'ຄ່າເອກະສານ', 'ຄ່າເພັກເກດຕ່າງປະເທດ', 'ຄ່າກິດຈະກຳ'].map(t => t.toLowerCase().replace(/\s/g, '-'))}>
                                {/* Accommodation */}
                                <CostCategoryContent title="ຄ່າທີ່ພັກ" icon={<BedDouble className="h-5 w-5" />} summary={<CategorySummary totals={accommodationTotals} />}>
                                    <div className="space-y-4">
                                        {allCosts.accommodations?.map((acc, index) => (
                                            <Card key={acc.id} className="border-none shadow-sm rounded-xl overflow-hidden bg-background/50">
                                                <CardHeader className="flex-row items-center justify-between px-6 py-4 bg-muted/20 border-b">
                                                    <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
                                                        <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center text-[10px] text-primary">
                                                            {index + 1}
                                                        </div>
                                                        ທີ່ພັກ
                                                    </CardTitle>
                                                    <div className="flex gap-1">
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-primary/10" onClick={() => toggleItemVisibility(acc.id)}>
                                                            {itemVisibility[acc.id] === false ? <EyeOff className="h-4 w-4 text-muted-foreground"/> : <Eye className="h-4 w-4 text-primary"/>}
                                                        </Button>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-destructive/10 group" onClick={() => deleteItem('accommodations', acc.id)}>
                                                            <Trash2 className="h-4 w-4 text-muted-foreground group-hover:text-destructive"/>
                                                        </Button>
                                                    </div>
                                                </CardHeader>
                                                {itemVisibility[acc.id] !== false && (
                                                    <CardContent className="p-6 space-y-6">
                                                        <div className="grid md:grid-cols-2 gap-6">
                                                            <div className="space-y-2.5">
                                                                <Label className="text-[10px] font-black uppercase tracking-wider text-foreground ml-1">ຊື່ທີ່ພັກ</Label>
                                                                <Input placeholder="ຊື່ທີ່ພັກ" value={acc.name} onChange={e => updateItem('accommodations', acc.id, 'name', e.target.value)} className="h-11 bg-muted/30 border-transparent focus:bg-background focus:ring-2 focus:ring-primary/20 transition-all rounded-xl font-bold" />
                                                            </div>
                                                            <div className="space-y-2.5">
                                                                <Label className="text-[10px] font-black uppercase tracking-wider text-foreground ml-1">ວັນທີເຊັກອິນ</Label>
                                                                <Popover>
                                                                    <PopoverTrigger asChild>
                                                                        <Button variant={"outline"} className="w-full h-11 justify-start text-left font-bold bg-muted/30 border-transparent hover:bg-muted/40 rounded-xl">
                                                                            <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                                                                            {acc.checkInDate ? format(toDateSafe(acc.checkInDate)!, "dd/MM/yyyy") : <span className="text-muted-foreground/50">ເລືອກວັນທີ</span>}
                                                                        </Button>
                                                                    </PopoverTrigger>
                                                                    <PopoverContent className="w-auto p-0 border-none shadow-xl rounded-2xl">
                                                                        <Calendar mode="single" selected={toDateSafe(acc.checkInDate) || undefined} onSelect={(date) => updateItem('accommodations', acc.id, 'checkInDate', date?.toISOString())} initialFocus />
                                                                    </PopoverContent>
                                                                </Popover>
                                                            </div>
                                                        </div>

                                                        <div className="h-px bg-muted/50 my-2" />

                                                        <div className="space-y-4">
                                                            <div className="flex items-center justify-between">
                                                                <Label className="text-[10px] font-black uppercase tracking-wider text-foreground ml-1">ລາຍລະອຽດຫ້ອງ</Label>
                                                                <Button variant="ghost" size="sm" className="h-8 text-[10px] font-black uppercase tracking-wider text-primary hover:bg-primary/10 rounded-lg" onClick={() => addRoom(acc.id)}>
                                                                    <PlusCircle className="mr-1.5 h-3.5 w-3.5"/>
                                                                    ເພີ່ມຫ້ອງ
                                                                </Button>
                                                            </div>
                                                            <div className="space-y-3">
                                                                {acc.rooms.map((room, rIdx) => (
                                                                    <div key={room.id} className="flex flex-wrap items-end gap-3 p-4 rounded-xl bg-muted/20 border border-transparent hover:border-primary/10 transition-all relative group">
                                                                        <div className="flex-1 min-w-[150px] space-y-1.5">
                                                                            <Label className="text-[9px] font-black uppercase tracking-wider text-muted-foreground/60">ປະເພດ</Label>
                                                                            <Input value={room.type} onChange={e => updateRoom(acc.id, room.id, 'type', e.target.value)} className="h-9 bg-background/50 border-transparent focus:bg-background rounded-lg font-bold text-sm" />
                                                                        </div>
                                                                        <div className="w-20 space-y-1.5">
                                                                            <Label className="text-[9px] font-black uppercase tracking-wider text-muted-foreground/60">ຫ້ອງ</Label>
                                                                            <Input type="number" value={room.numRooms} onChange={e => updateRoom(acc.id, room.id, 'numRooms', Number(e.target.value))} className="h-9 bg-background/50 border-transparent focus:bg-background rounded-lg font-bold text-sm text-center" />
                                                                        </div>
                                                                        <div className="w-20 space-y-1.5">
                                                                            <Label className="text-[9px] font-black uppercase tracking-wider text-muted-foreground/60">ຄືນ</Label>
                                                                            <Input type="number" value={room.numNights} onChange={e => updateRoom(acc.id, room.id, 'numNights', Number(e.target.value))} className="h-9 bg-background/50 border-transparent focus:bg-background rounded-lg font-bold text-sm text-center" />
                                                                        </div>
                                                                        <div className="w-32 space-y-1.5">
                                                                            <Label className="text-[9px] font-black uppercase tracking-wider text-muted-foreground/60">ລາຄາ</Label>
                                                                            <Input type="number" value={room.price} onChange={e => updateRoom(acc.id, room.id, 'price', Number(e.target.value))} className="h-9 bg-background/50 border-transparent focus:bg-background rounded-lg font-bold text-sm" />
                                                                        </div>
                                                                        <div className="w-24 space-y-1.5">
                                                                            <Label className="text-[9px] font-black uppercase tracking-wider text-muted-foreground/60">ສະກຸນເງິນ</Label>
                                                                            <Select value={room.currency} onValueChange={v => updateRoom(acc.id, room.id, 'currency', v)}>
                                                                                <SelectTrigger className="h-9 bg-background/50 border-transparent focus:bg-background rounded-lg font-bold text-xs"><SelectValue /></SelectTrigger>
                                                                                <SelectContent className="border-none shadow-xl rounded-xl">
                                                                                    {Object.keys(currencySymbols).map(c => <SelectItem key={c} value={c} className="font-bold">{c}</SelectItem>)}
                                                                                </SelectContent>
                                                                            </Select>
                                                                        </div>
                                                                        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors" onClick={() => deleteRoom(acc.id, room.id)}>
                                                                            <Trash2 className="h-4 w-4"/>
                                                                        </Button>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </CardContent>
                                                )}
                                            </Card>
                                        ))}
                                        <Button onClick={addAccommodation} variant="outline" className="w-full h-12 border-dashed border-2 hover:border-primary hover:bg-primary/5 text-primary font-black uppercase tracking-widest rounded-xl transition-all">
                                            <PlusCircle className="mr-2 h-5 w-5" />
                                            ເພີ່ມທີ່ພັກ
                                        </Button>
                                    </div>
                                </CostCategoryContent>

                                {/* Transport */}
                                <CostCategoryContent title="ຄ່າຂົນສົ່ງ" icon={<Truck className="h-5 w-5" />} summary={<CategorySummary totals={tripTotals} />}>
                                    <div className="space-y-4">
                                        {allCosts.trips?.map((trip, index) => (
                                            <Card key={trip.id} className="border-none shadow-sm rounded-xl overflow-hidden bg-background/50">
                                                <CardHeader className="flex-row items-center justify-between px-6 py-4 bg-muted/20 border-b">
                                                    <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
                                                        <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center text-[10px] text-primary">
                                                            {index + 1}
                                                        </div>
                                                        ລົດ
                                                    </CardTitle>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-destructive/10 group" onClick={() => deleteItem('trips', trip.id)}>
                                                        <Trash2 className="h-4 w-4 text-muted-foreground group-hover:text-destructive"/>
                                                    </Button>
                                                </CardHeader>
                                                <CardContent className="p-6 grid md:grid-cols-4 gap-6">
                                                    <div className="space-y-2.5 col-span-2">
                                                        <Label className="text-[10px] font-black uppercase tracking-wider text-foreground ml-1">ເສັ້ນທາງ/ປະເພດລົດ</Label>
                                                        <Input placeholder="ວຽງຈັນ - ວັງວຽງ (ລົດຕູ້)" value={trip.route} onChange={e => updateItem('trips', trip.id, 'route', e.target.value)} className="h-11 bg-muted/30 border-transparent focus:bg-background focus:ring-2 focus:ring-primary/20 transition-all rounded-xl font-bold" />
                                                    </div>
                                                    <div className="space-y-2.5">
                                                        <Label className="text-[10px] font-black uppercase tracking-wider text-foreground ml-1">ວັນທີ</Label>
                                                        <Popover>
                                                            <PopoverTrigger asChild>
                                                                <Button variant={"outline"} className="h-11 w-full justify-start text-left font-bold bg-muted/30 border-transparent hover:bg-muted/50 rounded-xl transition-all">
                                                                    <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                                                                    {trip.date ? format(toDateSafe(trip.date), "dd/MM/yyyy") : <span>ເລືອກວັນທີ</span>}
                                                                </Button>
                                                            </PopoverTrigger>
                                                            <PopoverContent className="w-auto p-0 rounded-xl overflow-hidden shadow-2xl border-none">
                                                                <Calendar mode="single" selected={toDateSafe(trip.date) || undefined} onSelect={date => updateItem('trips', trip.id, 'date', date?.toISOString())} initialFocus locale={th} />
                                                            </PopoverContent>
                                                        </Popover>
                                                    </div>
                                                    <div className="space-y-2.5">
                                                        <Label className="text-[10px] font-black uppercase tracking-wider text-foreground ml-1">ຄັນ</Label>
                                                        <Input type="number" value={trip.numVehicles} onChange={e => updateItem('trips', trip.id, 'numVehicles', Number(e.target.value))} className="h-11 bg-muted/30 border-transparent focus:bg-background focus:ring-2 focus:ring-primary/20 transition-all rounded-xl font-bold text-center" />
                                                    </div>
                                                    <div className="space-y-2.5">
                                                        <Label className="text-[10px] font-black uppercase tracking-wider text-foreground ml-1">ວັນ</Label>
                                                        <Input type="number" value={trip.numDays} onChange={e => updateItem('trips', trip.id, 'numDays', Number(e.target.value))} className="h-11 bg-muted/30 border-transparent focus:bg-background focus:ring-2 focus:ring-primary/20 transition-all rounded-xl font-bold text-center" />
                                                    </div>

                                                    <div className="h-px bg-muted/50 my-1 md:col-span-4" />

                                                    <div className="space-y-2.5 col-span-2">
                                                        <Label className="text-[10px] font-black uppercase tracking-wider text-foreground ml-1">ລາຄາ/ຄັນ/ວັນ</Label>
                                                        <Input type="number" value={trip.pricePerVehicle} onChange={e => updateItem('trips', trip.id, 'pricePerVehicle', Number(e.target.value))} className="h-11 bg-muted/30 border-transparent focus:bg-background focus:ring-2 focus:ring-primary/20 transition-all rounded-xl font-bold" />
                                                    </div>
                                                    <div className="space-y-2.5 col-span-2">
                                                        <Label className="text-[10px] font-black uppercase tracking-wider text-foreground ml-1">ສະກຸນເງິນ</Label>
                                                        <Select value={trip.currency} onValueChange={v => updateItem('trips', trip.id, 'currency', v)}>
                                                            <SelectTrigger className="h-11 bg-muted/30 border-transparent focus:bg-background focus:ring-2 focus:ring-primary/20 transition-all rounded-xl font-bold"><SelectValue /></SelectTrigger>
                                                            <SelectContent className="border-none shadow-xl rounded-xl">
                                                                {Object.keys(currencySymbols).map(c => <SelectItem key={c} value={c} className="font-bold">{c}</SelectItem>)}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ))}
                                        <Button onClick={addTrip} variant="outline" className="w-full h-12 border-dashed border-2 hover:border-primary hover:bg-primary/5 text-primary font-black uppercase tracking-widest rounded-xl transition-all">
                                            <PlusCircle className="mr-2 h-5 w-5" />
                                            ເພີ່ມຄ່າຂົນສົ່ງ
                                        </Button>
                                    </div>
                                </CostCategoryContent>

                                {/* Flights */}
                                <CostCategoryContent title="ຄ່າປີ້ຍົນ" icon={<Plane className="h-5 w-5" />} summary={<CategorySummary totals={flightTotals} />}>
                                    <div className="space-y-4">
                                        {allCosts.flights?.map((flight, index) => (
                                            <Card key={flight.id} className="border-none shadow-sm rounded-xl overflow-hidden bg-background/50">
                                                <CardHeader className="flex-row items-center justify-between px-6 py-4 bg-muted/20 border-b">
                                                    <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
                                                        <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center text-[10px] text-primary">
                                                            {index + 1}
                                                        </div>
                                                        ຖ້ຽວບິນ
                                                    </CardTitle>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-destructive/10 group" onClick={() => deleteItem('flights', flight.id)}>
                                                        <Trash2 className="h-4 w-4 text-muted-foreground group-hover:text-destructive"/>
                                                    </Button>
                                                </CardHeader>
                                                <CardContent className="p-6 grid md:grid-cols-3 gap-6">
                                                    <div className="space-y-2.5">
                                                        <Label className="text-[10px] font-black uppercase tracking-wider text-foreground ml-1">ຈາກ</Label>
                                                        <Input value={flight.from} onChange={e => updateItem('flights', flight.id, 'from', e.target.value)} className="h-11 bg-muted/30 border-transparent focus:bg-background focus:ring-2 focus:ring-primary/20 transition-all rounded-xl font-bold" />
                                                    </div>
                                                    <div className="space-y-2.5">
                                                        <Label className="text-[10px] font-black uppercase tracking-wider text-foreground ml-1">ໄປ</Label>
                                                        <Input value={flight.to} onChange={e => updateItem('flights', flight.id, 'to', e.target.value)} className="h-11 bg-muted/30 border-transparent focus:bg-background focus:ring-2 focus:ring-primary/20 transition-all rounded-xl font-bold" />
                                                    </div>
                                                    <div className="space-y-2.5">
                                                        <Label className="text-[10px] font-black uppercase tracking-wider text-foreground ml-1">ວັນທີອອກເດີນທາງ</Label>
                                                        <Popover>
                                                            <PopoverTrigger asChild>
                                                                <Button variant={"outline"} className="h-11 w-full justify-start text-left font-bold bg-muted/30 border-transparent hover:bg-muted/50 rounded-xl transition-all">
                                                                    <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                                                                    {flight.departureDate ? format(toDateSafe(flight.departureDate), "dd/MM/yyyy") : <span>ເລືອກວັນທີ</span>}
                                                                </Button>
                                                            </PopoverTrigger>
                                                            <PopoverContent className="w-auto p-0 rounded-xl overflow-hidden shadow-2xl border-none">
                                                                <Calendar mode="single" selected={toDateSafe(flight.departureDate) || undefined} onSelect={date => updateItem('flights', flight.id, 'departureDate', date?.toISOString())} initialFocus locale={th} />
                                                            </PopoverContent>
                                                        </Popover>
                                                    </div>

                                                    <div className="space-y-2.5">
                                                        <Label className="text-[10px] font-black uppercase tracking-wider text-foreground ml-1">ເວລາ</Label>
                                                        <Input value={flight.departureTime} onChange={e => updateItem('flights', flight.id, 'departureTime', e.target.value)} className="h-11 bg-muted/30 border-transparent focus:bg-background focus:ring-2 focus:ring-primary/20 transition-all rounded-xl font-bold" />
                                                    </div>
                                                    <div className="space-y-2.5">
                                                        <Label className="text-[10px] font-black uppercase tracking-wider text-foreground ml-1">ລາຄາ/ຄົນ</Label>
                                                        <Input type="number" value={flight.pricePerPerson} onChange={e => updateItem('flights', flight.id, 'pricePerPerson', Number(e.target.value))} className="h-11 bg-muted/30 border-transparent focus:bg-background focus:ring-2 focus:ring-primary/20 transition-all rounded-xl font-bold" />
                                                    </div>
                                                    <div className="space-y-2.5">
                                                        <Label className="text-[10px] font-black uppercase tracking-wider text-foreground ml-1">ຈຳນວນຄົນ</Label>
                                                        <Input type="number" value={flight.numPeople} onChange={e => updateItem('flights', flight.id, 'numPeople', Number(e.target.value))} className="h-11 bg-muted/30 border-transparent focus:bg-background focus:ring-2 focus:ring-primary/20 transition-all rounded-xl font-bold text-center" />
                                                    </div>

                                                    <div className="h-px bg-muted/50 my-1 md:col-span-3" />

                                                    <div className="space-y-2.5">
                                                        <Label className="text-[10px] font-black uppercase tracking-wider text-foreground ml-1">ສະກຸນເງິນ</Label>
                                                        <Select value={flight.currency} onValueChange={v => updateItem('flights', flight.id, 'currency', v)}>
                                                            <SelectTrigger className="h-11 bg-muted/30 border-transparent focus:bg-background focus:ring-2 focus:ring-primary/20 transition-all rounded-xl font-bold"><SelectValue /></SelectTrigger>
                                                            <SelectContent className="border-none shadow-xl rounded-xl">
                                                                {Object.keys(currencySymbols).map(c => <SelectItem key={c} value={c} className="font-bold">{c}</SelectItem>)}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ))}
                                        <Button onClick={addFlight} variant="outline" className="w-full h-12 border-dashed border-2 hover:border-primary hover:bg-primary/5 text-primary font-black uppercase tracking-widest rounded-xl transition-all">
                                            <PlusCircle className="mr-2 h-5 w-5" />
                                            ເພີ່ມຄ່າປີ້ຍົນ
                                        </Button>
                                    </div>
                                </CostCategoryContent>

                                {/* Train */}
                                <CostCategoryContent title="ຄ່າປີ້ລົດໄຟ" icon={<TrainFront className="h-5 w-5" />} summary={<CategorySummary totals={trainTotals} />}>
                                    <div className="space-y-4">
                                        {allCosts.trainTickets?.map((ticket, index) => (
                                            <Card key={ticket.id} className="border-none shadow-sm rounded-xl overflow-hidden bg-background/50">
                                                <CardHeader className="flex-row items-center justify-between px-6 py-4 bg-muted/20 border-b">
                                                    <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
                                                        <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center text-[10px] text-primary">
                                                            {index + 1}
                                                        </div>
                                                        ປີ້ລົດໄຟ
                                                    </CardTitle>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-destructive/10 group" onClick={() => deleteItem('trainTickets', ticket.id)}>
                                                        <Trash2 className="h-4 w-4 text-muted-foreground group-hover:text-destructive"/>
                                                    </Button>
                                                </CardHeader>
                                                <CardContent className="p-6 grid md:grid-cols-3 gap-6">
                                                    <div className="space-y-2.5 col-span-2">
                                                        <Label className="text-[10px] font-black uppercase tracking-wider text-foreground ml-1">ເສັ້ນທາງ</Label>
                                                        <Input placeholder="ຈາກ - ໄປ" value={ticket.from} onChange={e => updateItem('trainTickets', ticket.id, 'from', e.target.value)} className="h-11 bg-muted/30 border-transparent focus:bg-background focus:ring-2 focus:ring-primary/20 transition-all rounded-xl font-bold" />
                                                    </div>
                                                    <div className="space-y-2.5">
                                                        <Label className="text-[10px] font-black uppercase tracking-wider text-foreground ml-1">ວັນທີອອກເດີນທາງ</Label>
                                                        <Popover>
                                                            <PopoverTrigger asChild>
                                                                <Button variant={"outline"} className="h-11 w-full justify-start text-left font-bold bg-muted/30 border-transparent hover:bg-muted/50 rounded-xl transition-all">
                                                                    <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                                                                    {ticket.departureDate ? format(toDateSafe(ticket.departureDate), "dd/MM/yyyy") : <span>ເລືອກວັນທີ</span>}
                                                                </Button>
                                                            </PopoverTrigger>
                                                            <PopoverContent className="w-auto p-0 rounded-xl overflow-hidden shadow-2xl border-none">
                                                                <Calendar mode="single" selected={toDateSafe(ticket.departureDate) || undefined} onSelect={date => updateItem('trainTickets', ticket.id, 'departureDate', date?.toISOString())} initialFocus locale={th} />
                                                            </PopoverContent>
                                                        </Popover>
                                                    </div>

                                                    <div className="space-y-2.5">
                                                        <Label className="text-[10px] font-black uppercase tracking-wider text-foreground ml-1">ເວລາ</Label>
                                                        <Input value={ticket.departureTime} onChange={e => updateItem('trainTickets', ticket.id, 'departureTime', e.target.value)} className="h-11 bg-muted/30 border-transparent focus:bg-background focus:ring-2 focus:ring-primary/20 transition-all rounded-xl font-bold" />
                                                    </div>
                                                    <div className="space-y-2.5">
                                                        <Label className="text-[10px] font-black uppercase tracking-wider text-foreground ml-1">ຊັ້ນປີ້</Label>
                                                        <Input value={ticket.ticketClass} onChange={e => updateItem('trainTickets', ticket.id, 'ticketClass', e.target.value)} className="h-11 bg-muted/30 border-transparent focus:bg-background focus:ring-2 focus:ring-primary/20 transition-all rounded-xl font-bold" />
                                                    </div>
                                                    <div className="space-y-2.5">
                                                        <Label className="text-[10px] font-black uppercase tracking-wider text-foreground ml-1">ຈຳນວນປີ້</Label>
                                                        <Input type="number" value={ticket.numTickets} onChange={e => updateItem('trainTickets', ticket.id, 'numTickets', Number(e.target.value))} className="h-11 bg-muted/30 border-transparent focus:bg-background focus:ring-2 focus:ring-primary/20 transition-all rounded-xl font-bold text-center" />
                                                    </div>

                                                    <div className="h-px bg-muted/50 my-1 md:col-span-3" />

                                                    <div className="space-y-2.5">
                                                        <Label className="text-[10px] font-black uppercase tracking-wider text-foreground ml-1">ລາຄາ/ປີ້</Label>
                                                        <Input type="number" value={ticket.pricePerTicket} onChange={e => updateItem('trainTickets', ticket.id, 'pricePerTicket', Number(e.target.value))} className="h-11 bg-muted/30 border-transparent focus:bg-background focus:ring-2 focus:ring-primary/20 transition-all rounded-xl font-bold" />
                                                    </div>
                                                    <div className="space-y-2.5 col-span-2">
                                                        <Label className="text-[10px] font-black uppercase tracking-wider text-foreground ml-1">ສະກຸນເງິນ</Label>
                                                        <Select value={ticket.currency} onValueChange={v => updateItem('trainTickets', ticket.id, 'currency', v)}>
                                                            <SelectTrigger className="h-11 bg-muted/30 border-transparent focus:bg-background focus:ring-2 focus:ring-primary/20 transition-all rounded-xl font-bold"><SelectValue /></SelectTrigger>
                                                            <SelectContent className="border-none shadow-xl rounded-xl">
                                                                {Object.keys(currencySymbols).map(c => <SelectItem key={c} value={c} className="font-bold">{c}</SelectItem>)}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ))}
                                        <Button onClick={addTrainTicket} variant="outline" className="w-full h-12 border-dashed border-2 hover:border-primary hover:bg-primary/5 text-primary font-black uppercase tracking-widest rounded-xl transition-all">
                                            <PlusCircle className="mr-2 h-5 w-5" />
                                            ເພີ່ມຄ່າປີ້ລົດໄຟ
                                        </Button>
                                    </div>
                                </CostCategoryContent>

                                {/* Entrance Fees */}
                                <CostCategoryContent title="ຄ່າເຂົ້າຊົມສະຖານທີ່" icon={<Camera className="h-5 w-5" />} summary={<CategorySummary totals={entranceFeeTotals} />}>
                                    <div className="space-y-4">
                                        {allCosts.entranceFees?.map((fee, index) => (
                                            <Card key={fee.id} className="border-none shadow-sm rounded-xl overflow-hidden bg-background/50">
                                                <CardHeader className="flex-row items-center justify-between px-6 py-4 bg-muted/20 border-b">
                                                    <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
                                                        <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center text-[10px] text-primary">
                                                            {index + 1}
                                                        </div>
                                                        ສະຖານທີ່
                                                    </CardTitle>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-destructive/10 group" onClick={() => deleteItem('entranceFees', fee.id)}>
                                                        <Trash2 className="h-4 w-4 text-muted-foreground group-hover:text-destructive"/>
                                                    </Button>
                                                </CardHeader>
                                                <CardContent className="p-6 grid md:grid-cols-4 gap-6">
                                                    <div className="space-y-2.5 col-span-2">
                                                        <Label className="text-[10px] font-black uppercase tracking-wider text-foreground ml-1">ຊື່ສະຖານທີ່</Label>
                                                        <Input value={fee.locationName} onChange={e => updateItem('entranceFees', fee.id, 'locationName', e.target.value)} className="h-11 bg-muted/30 border-transparent focus:bg-background focus:ring-2 focus:ring-primary/20 transition-all rounded-xl font-bold" />
                                                    </div>
                                                    <div className="space-y-2.5">
                                                        <Label className="text-[10px] font-black uppercase tracking-wider text-foreground ml-1">ວັນທີ</Label>
                                                        <Popover>
                                                            <PopoverTrigger asChild>
                                                                <Button variant={"outline"} className="h-11 w-full justify-start text-left font-bold bg-muted/30 border-transparent hover:bg-muted/50 rounded-xl transition-all">
                                                                    <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                                                                    {fee.date ? format(toDateSafe(fee.date), "dd/MM/yyyy") : <span>ເລືອກວັນທີ</span>}
                                                                </Button>
                                                            </PopoverTrigger>
                                                            <PopoverContent className="w-auto p-0 rounded-xl overflow-hidden shadow-2xl border-none">
                                                                <Calendar mode="single" selected={toDateSafe(fee.date) || undefined} onSelect={date => updateItem('entranceFees', fee.id, 'date', date?.toISOString())} initialFocus locale={th} />
                                                            </PopoverContent>
                                                        </Popover>
                                                    </div>
                                                    <div className="space-y-2.5">
                                                        <Label className="text-[10px] font-black uppercase tracking-wider text-foreground ml-1">Pax</Label>
                                                        <Input type="number" value={fee.pax} onChange={e => updateItem('entranceFees', fee.id, 'pax', Number(e.target.value))} className="h-11 bg-muted/30 border-transparent focus:bg-background focus:ring-2 focus:ring-primary/20 transition-all rounded-xl font-bold text-center" />
                                                    </div>

                                                    <div className="h-px bg-muted/50 my-1 md:col-span-4" />

                                                    <div className="space-y-2.5">
                                                        <Label className="text-[10px] font-black uppercase tracking-wider text-foreground ml-1">ລາຄາ</Label>
                                                        <Input type="number" value={fee.price} onChange={e => updateItem('entranceFees', fee.id, 'price', Number(e.target.value))} className="h-11 bg-muted/30 border-transparent focus:bg-background focus:ring-2 focus:ring-primary/20 transition-all rounded-xl font-bold" />
                                                    </div>
                                                    <div className="space-y-2.5 col-span-2">
                                                        <Label className="text-[10px] font-black uppercase tracking-wider text-foreground ml-1">ສະກຸນເງິນ</Label>
                                                        <Select value={fee.currency} onValueChange={v => updateItem('entranceFees', fee.id, 'currency', v)}>
                                                            <SelectTrigger className="h-11 bg-muted/30 border-transparent focus:bg-background focus:ring-2 focus:ring-primary/20 transition-all rounded-xl font-bold"><SelectValue /></SelectTrigger>
                                                            <SelectContent className="border-none shadow-xl rounded-xl">
                                                                {Object.keys(currencySymbols).map(c => <SelectItem key={c} value={c} className="font-bold">{c}</SelectItem>)}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ))}
                                        <Button onClick={addEntranceFee} variant="outline" className="w-full h-12 border-dashed border-2 hover:border-primary hover:bg-primary/5 text-primary font-black uppercase tracking-widest rounded-xl transition-all">
                                            <PlusCircle className="mr-2 h-5 w-5" />
                                            ເພີ່ມຄ່າເຂົ້າຊົມ
                                        </Button>
                                    </div>
                                </CostCategoryContent>

                                {/* Meals */}
                                <CostCategoryContent title="ຄ່າອາຫານ" icon={<UtensilsCrossed className="h-5 w-5" />} summary={<CategorySummary totals={mealTotals} />}>
                                    <div className="space-y-4">
                                        {allCosts.meals?.map((meal, index) => (
                                            <Card key={meal.id} className="border-none shadow-sm rounded-xl overflow-hidden bg-background/50">
                                                <CardHeader className="flex-row items-center justify-between px-6 py-4 bg-muted/20 border-b">
                                                    <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
                                                        <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center text-[10px] text-primary">
                                                            {index + 1}
                                                        </div>
                                                        ລາຍການອາຫານ
                                                    </CardTitle>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-destructive/10 group" onClick={() => deleteItem('meals', meal.id)}>
                                                        <Trash2 className="h-4 w-4 text-muted-foreground group-hover:text-destructive"/>
                                                    </Button>
                                                </CardHeader>
                                                <CardContent className="p-6 space-y-6">
                                                    <div className="grid md:grid-cols-3 gap-6">
                                                        <div className="space-y-2.5">
                                                            <Label className="text-[10px] font-black uppercase tracking-wider text-foreground ml-1">ຊື່ລາຍການ</Label>
                                                            <Input value={meal.name} onChange={e => updateItem('meals', meal.id, 'name', e.target.value)} className="h-11 bg-muted/30 border-transparent focus:bg-background focus:ring-2 focus:ring-primary/20 transition-all rounded-xl font-bold" />
                                                        </div>
                                                        <div className="space-y-2.5">
                                                            <Label className="text-[10px] font-black uppercase tracking-wider text-foreground ml-1">ວັນທີ</Label>
                                                            <Popover>
                                                                <PopoverTrigger asChild>
                                                                    <Button variant={"outline"} className="h-11 w-full justify-start text-left font-bold bg-muted/30 border-transparent hover:bg-muted/50 rounded-xl transition-all">
                                                                        <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                                                                        {meal.date ? format(toDateSafe(meal.date), "dd/MM/yyyy") : <span>ເລືອກວັນທີ</span>}
                                                                    </Button>
                                                                </PopoverTrigger>
                                                                <PopoverContent className="w-auto p-0 rounded-xl overflow-hidden shadow-2xl border-none">
                                                                    <Calendar mode="single" selected={toDateSafe(meal.date) || undefined} onSelect={date => updateItem('meals', meal.id, 'date', date?.toISOString())} initialFocus locale={th} />
                                                                </PopoverContent>
                                                            </Popover>
                                                        </div>
                                                        <div className="space-y-2.5">
                                                            <Label className="text-[10px] font-black uppercase tracking-wider text-foreground ml-1">Pax</Label>
                                                            <Input type="number" value={meal.pax} onChange={e => updateItem('meals', meal.id, 'pax', Number(e.target.value))} className="h-11 bg-muted/30 border-transparent focus:bg-background focus:ring-2 focus:ring-primary/20 transition-all rounded-xl font-bold text-center" />
                                                        </div>
                                                    </div>

                                                    <div className="h-px bg-muted/50 my-1" />

                                                    <div className="grid grid-cols-3 gap-6">
                                                        <div className="space-y-2.5">
                                                            <Label className="text-[10px] font-black uppercase tracking-wider text-foreground ml-1">ເຊົ້າ (ມື້)</Label>
                                                            <Input type="number" value={meal.breakfast} onChange={e => updateItem('meals', meal.id, 'breakfast', Number(e.target.value))} className="h-11 bg-muted/30 border-transparent focus:bg-background focus:ring-2 focus:ring-primary/20 transition-all rounded-xl font-bold text-center" />
                                                        </div>
                                                        <div className="space-y-2.5">
                                                            <Label className="text-[10px] font-black uppercase tracking-wider text-foreground ml-1">ທ່ຽງ (ມື້)</Label>
                                                            <Input type="number" value={meal.lunch} onChange={e => updateItem('meals', meal.id, 'lunch', Number(e.target.value))} className="h-11 bg-muted/30 border-transparent focus:bg-background focus:ring-2 focus:ring-primary/20 transition-all rounded-xl font-bold text-center" />
                                                        </div>
                                                        <div className="space-y-2.5">
                                                            <Label className="text-[10px] font-black uppercase tracking-wider text-foreground ml-1">ແລງ (ມື້)</Label>
                                                            <Input type="number" value={meal.dinner} onChange={e => updateItem('meals', meal.id, 'dinner', Number(e.target.value))} className="h-11 bg-muted/30 border-transparent focus:bg-background focus:ring-2 focus:ring-primary/20 transition-all rounded-xl font-bold text-center" />
                                                        </div>
                                                    </div>

                                                    <div className="h-px bg-muted/50 my-1" />

                                                    <div className="grid md:grid-cols-2 gap-6">
                                                        <div className="space-y-2.5">
                                                            <Label className="text-[10px] font-black uppercase tracking-wider text-foreground ml-1">ລາຄາ/ມື້</Label>
                                                            <Input type="number" value={meal.pricePerMeal} onChange={e => updateItem('meals', meal.id, 'pricePerMeal', Number(e.target.value))} className="h-11 bg-muted/30 border-transparent focus:bg-background focus:ring-2 focus:ring-primary/20 transition-all rounded-xl font-bold" />
                                                        </div>
                                                        <div className="space-y-2.5">
                                                            <Label className="text-[10px] font-black uppercase tracking-wider text-foreground ml-1">ສະກຸນເງິນ</Label>
                                                            <Select value={meal.currency} onValueChange={v => updateItem('meals', meal.id, 'currency', v)}>
                                                                <SelectTrigger className="h-11 bg-muted/30 border-transparent focus:bg-background focus:ring-2 focus:ring-primary/20 transition-all rounded-xl font-bold"><SelectValue /></SelectTrigger>
                                                                <SelectContent className="border-none shadow-xl rounded-xl">
                                                                    {Object.keys(currencySymbols).map(c => <SelectItem key={c} value={c} className="font-bold">{c}</SelectItem>)}
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ))}
                                        <Button onClick={addMealCost} variant="outline" className="w-full h-12 border-dashed border-2 hover:border-primary hover:bg-primary/5 text-primary font-black uppercase tracking-widest rounded-xl transition-all">
                                            <PlusCircle className="mr-2 h-5 w-5" />
                                            ເພີ່ມຄ່າອາຫານ
                                        </Button>
                                    </div>
                                </CostCategoryContent>

                                {/* Guide */}
                                <CostCategoryContent title="ຄ່າໄກ້" icon={<Users className="h-5 w-5" />} summary={<CategorySummary totals={guideTotals} />}>
                                    <div className="space-y-4">
                                        {allCosts.guides?.map((guide, index) => (
                                            <Card key={guide.id} className="border-none shadow-sm rounded-xl overflow-hidden bg-background/50">
                                                <CardHeader className="flex-row items-center justify-between px-6 py-4 bg-muted/20 border-b">
                                                    <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
                                                        <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center text-[10px] text-primary">
                                                            {index + 1}
                                                        </div>
                                                        ໄກ້
                                                    </CardTitle>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-destructive/10 group" onClick={() => deleteItem('guides', guide.id)}>
                                                        <Trash2 className="h-4 w-4 text-muted-foreground group-hover:text-destructive"/>
                                                    </Button>
                                                </CardHeader>
                                                <CardContent className="p-6 grid md:grid-cols-4 gap-6">
                                                    <div className="space-y-2.5 col-span-2">
                                                        <Label className="text-[10px] font-black uppercase tracking-wider text-foreground ml-1">ຊື່ໄກ້</Label>
                                                        <Input value={guide.guideName} onChange={e => updateItem('guides', guide.id, 'guideName', e.target.value)} className="h-11 bg-muted/30 border-transparent focus:bg-background focus:ring-2 focus:ring-primary/20 transition-all rounded-xl font-bold" />
                                                    </div>
                                                    <div className="space-y-2.5">
                                                        <Label className="text-[10px] font-black uppercase tracking-wider text-foreground ml-1">ວັນທີ</Label>
                                                        <Popover>
                                                            <PopoverTrigger asChild>
                                                                <Button variant={"outline"} className="h-11 w-full justify-start text-left font-bold bg-muted/30 border-transparent hover:bg-muted/50 rounded-xl transition-all">
                                                                    <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                                                                    {guide.date ? format(toDateSafe(guide.date), "dd/MM/yyyy") : <span>ເລືອກວັນທີ</span>}
                                                                </Button>
                                                            </PopoverTrigger>
                                                            <PopoverContent className="w-auto p-0 rounded-xl overflow-hidden shadow-2xl border-none">
                                                                <Calendar mode="single" selected={toDateSafe(guide.date) || undefined} onSelect={date => updateItem('guides', guide.id, 'date', date?.toISOString())} initialFocus locale={th} />
                                                            </PopoverContent>
                                                        </Popover>
                                                    </div>
                                                    <div className="space-y-2.5">
                                                        <Label className="text-[10px] font-black uppercase tracking-wider text-foreground ml-1">ຄົນ</Label>
                                                        <Input type="number" value={guide.numGuides} onChange={e => updateItem('guides', guide.id, 'numGuides', Number(e.target.value))} className="h-11 bg-muted/30 border-transparent focus:bg-background focus:ring-2 focus:ring-primary/20 transition-all rounded-xl font-bold text-center" />
                                                    </div>
                                                    <div className="space-y-2.5">
                                                        <Label className="text-[10px] font-black uppercase tracking-wider text-foreground ml-1">ວັນ</Label>
                                                        <Input type="number" value={guide.numDays} onChange={e => updateItem('guides', guide.id, 'numDays', Number(e.target.value))} className="h-11 bg-muted/30 border-transparent focus:bg-background focus:ring-2 focus:ring-primary/20 transition-all rounded-xl font-bold text-center" />
                                                    </div>

                                                    <div className="h-px bg-muted/50 my-1 md:col-span-4" />

                                                    <div className="space-y-2.5 col-span-2">
                                                        <Label className="text-[10px] font-black uppercase tracking-wider text-foreground ml-1">ລາຄາ/ວັນ</Label>
                                                        <Input type="number" value={guide.pricePerDay} onChange={e => updateItem('guides', guide.id, 'pricePerDay', Number(e.target.value))} className="h-11 bg-muted/30 border-transparent focus:bg-background focus:ring-2 focus:ring-primary/20 transition-all rounded-xl font-bold" />
                                                    </div>
                                                    <div className="space-y-2.5 col-span-2">
                                                        <Label className="text-[10px] font-black uppercase tracking-wider text-foreground ml-1">ສະກຸນເງິນ</Label>
                                                        <Select value={guide.currency} onValueChange={v => updateItem('guides', guide.id, 'currency', v)}>
                                                            <SelectTrigger className="h-11 bg-muted/30 border-transparent focus:bg-background focus:ring-2 focus:ring-primary/20 transition-all rounded-xl font-bold"><SelectValue /></SelectTrigger>
                                                            <SelectContent className="border-none shadow-xl rounded-xl">
                                                                {Object.keys(currencySymbols).map(c => <SelectItem key={c} value={c} className="font-bold">{c}</SelectItem>)}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ))}
                                        <Button onClick={addGuideFee} variant="outline" className="w-full h-12 border-dashed border-2 hover:border-primary hover:bg-primary/5 text-primary font-black uppercase tracking-widest rounded-xl transition-all">
                                            <PlusCircle className="mr-2 h-5 w-5" />
                                            ເພີ່ມຄ່າໄກ້
                                        </Button>
                                    </div>
                                </CostCategoryContent>

                                {/* Documents */}
                                <CostCategoryContent title="ຄ່າເອກະສານ" icon={<FileText className="h-5 w-5" />} summary={<CategorySummary totals={documentTotals} />}>
                                    <div className="space-y-4">
                                        {allCosts.documents?.map((doc, index) => (
                                            <Card key={doc.id} className="border-none shadow-sm rounded-xl overflow-hidden bg-background/50">
                                                <CardHeader className="flex-row items-center justify-between px-6 py-4 bg-muted/20 border-b">
                                                    <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
                                                        <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center text-[10px] text-primary">
                                                            {index + 1}
                                                        </div>
                                                        ເອກະສານ
                                                    </CardTitle>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-destructive/10 group" onClick={() => deleteItem('documents', doc.id)}>
                                                        <Trash2 className="h-4 w-4 text-muted-foreground group-hover:text-destructive"/>
                                                    </Button>
                                                </CardHeader>
                                                <CardContent className="p-6 grid md:grid-cols-4 gap-6">
                                                    <div className="space-y-2.5 col-span-2">
                                                        <Label className="text-[10px] font-black uppercase tracking-wider text-foreground ml-1">ຊື່ເອກະສານ</Label>
                                                        <Input value={doc.documentName} onChange={e => updateItem('documents', doc.id, 'documentName', e.target.value)} className="h-11 bg-muted/30 border-transparent focus:bg-background focus:ring-2 focus:ring-primary/20 transition-all rounded-xl font-bold" />
                                                    </div>
                                                    <div className="space-y-2.5">
                                                        <Label className="text-[10px] font-black uppercase tracking-wider text-foreground ml-1">ວັນທີ</Label>
                                                        <Popover>
                                                            <PopoverTrigger asChild>
                                                                <Button variant={"outline"} className="h-11 w-full justify-start text-left font-bold bg-muted/30 border-transparent hover:bg-muted/50 rounded-xl transition-all">
                                                                    <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                                                                    {doc.date ? format(toDateSafe(doc.date), "dd/MM/yyyy") : <span>ເລືອກວັນທີ</span>}
                                                                </Button>
                                                            </PopoverTrigger>
                                                            <PopoverContent className="w-auto p-0 rounded-xl overflow-hidden shadow-2xl border-none">
                                                                <Calendar mode="single" selected={toDateSafe(doc.date) || undefined} onSelect={date => updateItem('documents', doc.id, 'date', date?.toISOString())} initialFocus locale={th} />
                                                            </PopoverContent>
                                                        </Popover>
                                                    </div>
                                                    <div className="space-y-2.5">
                                                        <Label className="text-[10px] font-black uppercase tracking-wider text-foreground ml-1">Pax</Label>
                                                        <Input type="number" value={doc.pax} onChange={e => updateItem('documents', doc.id, 'pax', Number(e.target.value))} className="h-11 bg-muted/30 border-transparent focus:bg-background focus:ring-2 focus:ring-primary/20 transition-all rounded-xl font-bold text-center" />
                                                    </div>

                                                    <div className="h-px bg-muted/50 my-1 md:col-span-3" />

                                                    <div className="space-y-2.5">
                                                        <Label className="text-[10px] font-black uppercase tracking-wider text-foreground ml-1">ລາຄາ</Label>
                                                        <Input type="number" value={doc.price} onChange={e => updateItem('documents', doc.id, 'price', Number(e.target.value))} className="h-11 bg-muted/30 border-transparent focus:bg-background focus:ring-2 focus:ring-primary/20 transition-all rounded-xl font-bold" />
                                                    </div>
                                                    <div className="space-y-2.5 col-span-2">
                                                        <Label className="text-[10px] font-black uppercase tracking-wider text-foreground ml-1">ສະກຸນເງິນ</Label>
                                                        <Select value={doc.currency} onValueChange={v => updateItem('documents', doc.id, 'currency', v)}>
                                                            <SelectTrigger className="h-11 bg-muted/30 border-transparent focus:bg-background focus:ring-2 focus:ring-primary/20 transition-all rounded-xl font-bold"><SelectValue /></SelectTrigger>
                                                            <SelectContent className="border-none shadow-xl rounded-xl">
                                                                {Object.keys(currencySymbols).map(c => <SelectItem key={c} value={c} className="font-bold">{c}</SelectItem>)}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ))}
                                        <Button onClick={addDocumentFee} variant="outline" className="w-full h-12 border-dashed border-2 hover:border-primary hover:bg-primary/5 text-primary font-black uppercase tracking-widest rounded-xl transition-all">
                                            <PlusCircle className="mr-2 h-5 w-5" />
                                            ເພີ່ມຄ່າເອກະສານ
                                        </Button>
                                    </div>
                                </CostCategoryContent>

                                {/* Overseas Package */}
                                <CostCategoryContent title="ຄ່າເພັກເກດຕ່າງປະເທດ" icon={<Earth className="h-5 w-5" />} summary={<CategorySummary totals={overseasPackageTotals} />}>
                                    <div className="space-y-4">
                                        {allCosts.overseasPackages?.map((pkg, index) => (
                                            <Card key={pkg.id} className="border-none shadow-sm rounded-xl overflow-hidden bg-background/50">
                                                <CardHeader className="flex-row items-center justify-between px-6 py-4 bg-muted/20 border-b">
                                                    <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
                                                        <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center text-[10px] text-primary">
                                                            {index + 1}
                                                        </div>
                                                        ແພັກເກດ
                                                    </CardTitle>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-destructive/10 group" onClick={() => deleteItem('overseasPackages', pkg.id)}>
                                                        <Trash2 className="h-4 w-4 text-muted-foreground group-hover:text-destructive"/>
                                                    </Button>
                                                </CardHeader>
                                                <CardContent className="p-6 grid md:grid-cols-4 gap-6">
                                                    <div className="space-y-2.5 col-span-2">
                                                        <Label className="text-[10px] font-black uppercase tracking-wider text-foreground ml-1">ຊື່ແພັກເກດ</Label>
                                                        <Input value={pkg.name} onChange={e => updateItem('overseasPackages', pkg.id, 'name', e.target.value)} className="h-11 bg-muted/30 border-transparent focus:bg-background focus:ring-2 focus:ring-primary/20 transition-all rounded-xl font-bold" />
                                                    </div>
                                                    <div className="space-y-2.5 col-span-2">
                                                        <Label className="text-[10px] font-black uppercase tracking-wider text-foreground ml-1">ວັນທີ</Label>
                                                        <Popover>
                                                            <PopoverTrigger asChild>
                                                                <Button variant={"outline"} className="h-11 w-full justify-start text-left font-bold bg-muted/30 border-transparent hover:bg-muted/50 rounded-xl transition-all">
                                                                    <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                                                                    {pkg.date ? format(toDateSafe(pkg.date), "dd/MM/yyyy") : <span>ເລືອກວັນທີ</span>}
                                                                </Button>
                                                            </PopoverTrigger>
                                                            <PopoverContent className="w-auto p-0 rounded-xl overflow-hidden shadow-2xl border-none">
                                                                <Calendar mode="single" selected={toDateSafe(pkg.date) || undefined} onSelect={date => updateItem('overseasPackages', pkg.id, 'date', date?.toISOString())} initialFocus locale={th} />
                                                            </PopoverContent>
                                                        </Popover>
                                                    </div>

                                                    <div className="h-px bg-muted/50 my-1 md:col-span-4" />

                                                    <div className="space-y-2.5">
                                                        <Label className="text-[10px] font-black uppercase tracking-wider text-foreground ml-1">USD</Label>
                                                        <Input type="number" value={pkg.priceUSD} onChange={e => updateItem('overseasPackages', pkg.id, 'priceUSD', Number(e.target.value))} className="h-11 bg-muted/30 border-transparent focus:bg-background focus:ring-2 focus:ring-primary/20 transition-all rounded-xl font-bold" />
                                                    </div>
                                                    <div className="space-y-2.5">
                                                        <Label className="text-[10px] font-black uppercase tracking-wider text-foreground ml-1">THB</Label>
                                                        <Input type="number" value={pkg.priceTHB} onChange={e => updateItem('overseasPackages', pkg.id, 'priceTHB', Number(e.target.value))} className="h-11 bg-muted/30 border-transparent focus:bg-background focus:ring-2 focus:ring-primary/20 transition-all rounded-xl font-bold" />
                                                    </div>
                                                    <div className="space-y-2.5">
                                                        <Label className="text-[10px] font-black uppercase tracking-wider text-foreground ml-1">CNY</Label>
                                                        <Input type="number" value={pkg.priceCNY} onChange={e => updateItem('overseasPackages', pkg.id, 'priceCNY', Number(e.target.value))} className="h-11 bg-muted/30 border-transparent focus:bg-background focus:ring-2 focus:ring-primary/20 transition-all rounded-xl font-bold" />
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ))}
                                        <Button onClick={addOverseasPackage} variant="outline" className="w-full h-12 border-dashed border-2 hover:border-primary hover:bg-primary/5 text-primary font-black uppercase tracking-widest rounded-xl transition-all">
                                            <PlusCircle className="mr-2 h-5 w-5" />
                                            ເພີ່ມແພັກເກດ
                                        </Button>
                                    </div>
                                </CostCategoryContent>

                                {/* Activities */}
                                <CostCategoryContent title="ຄ່າກິດຈະກຳ" icon={<Bike className="h-5 w-5" />} summary={<CategorySummary totals={activityTotals} />}>
                                    <div className="space-y-4">
                                        {allCosts.activities?.map((activity, index) => (
                                            <Card key={activity.id} className="border-none shadow-sm rounded-xl overflow-hidden bg-background/50">
                                                <CardHeader className="flex-row items-center justify-between px-6 py-4 bg-muted/20 border-b">
                                                    <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
                                                        <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center text-[10px] text-primary">
                                                            {index + 1}
                                                        </div>
                                                        ກິດຈະກຳ
                                                    </CardTitle>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-destructive/10 group" onClick={() => deleteItem('activities', activity.id)}>
                                                        <Trash2 className="h-4 w-4 text-muted-foreground group-hover:text-destructive"/>
                                                    </Button>
                                                </CardHeader>
                                                <CardContent className="p-6 grid md:grid-cols-4 gap-6">
                                                    <div className="space-y-2.5 col-span-2">
                                                        <Label className="text-[10px] font-black uppercase tracking-wider text-foreground ml-1">ຊື່ກິດຈະກຳ</Label>
                                                        <Input value={activity.name} onChange={e => updateItem('activities', activity.id, 'name', e.target.value)} className="h-11 bg-muted/30 border-transparent focus:bg-background focus:ring-2 focus:ring-primary/20 transition-all rounded-xl font-bold" />
                                                    </div>
                                                    <div className="space-y-2.5">
                                                        <Label className="text-[10px] font-black uppercase tracking-wider text-foreground ml-1">ວັນທີ</Label>
                                                        <Popover>
                                                            <PopoverTrigger asChild>
                                                                <Button variant={"outline"} className="h-11 w-full justify-start text-left font-bold bg-muted/30 border-transparent hover:bg-muted/50 rounded-xl transition-all">
                                                                    <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                                                                    {activity.date ? format(toDateSafe(activity.date), "dd/MM/yyyy") : <span>ເລືອກວັນທີ</span>}
                                                                </Button>
                                                            </PopoverTrigger>
                                                            <PopoverContent className="w-auto p-0 rounded-xl overflow-hidden shadow-2xl border-none">
                                                                <Calendar mode="single" selected={toDateSafe(activity.date) || undefined} onSelect={date => updateItem('activities', activity.id, 'date', date?.toISOString())} initialFocus locale={th} />
                                                            </PopoverContent>
                                                        </Popover>
                                                    </div>
                                                    <div className="space-y-2.5">
                                                        <Label className="text-[10px] font-black uppercase tracking-wider text-foreground ml-1">Pax</Label>
                                                        <Input type="number" value={activity.pax} onChange={e => updateItem('activities', activity.id, 'pax', Number(e.target.value))} className="h-11 bg-muted/30 border-transparent focus:bg-background focus:ring-2 focus:ring-primary/20 transition-all rounded-xl font-bold text-center" />
                                                    </div>

                                                    <div className="h-px bg-muted/50 my-1 md:col-span-3" />

                                                    <div className="space-y-2.5">
                                                        <Label className="text-[10px] font-black uppercase tracking-wider text-foreground ml-1">ລາຄາ</Label>
                                                        <Input type="number" value={activity.price} onChange={e => updateItem('activities', activity.id, 'price', Number(e.target.value))} className="h-11 bg-muted/30 border-transparent focus:bg-background focus:ring-2 focus:ring-primary/20 transition-all rounded-xl font-bold" />
                                                    </div>
                                                    <div className="space-y-2.5 col-span-2">
                                                        <Label className="text-[10px] font-black uppercase tracking-wider text-foreground ml-1">ສະກຸນເງິນ</Label>
                                                        <Select value={activity.currency} onValueChange={v => updateItem('activities', activity.id, 'currency', v)}>
                                                            <SelectTrigger className="h-11 bg-muted/30 border-transparent focus:bg-background focus:ring-2 focus:ring-primary/20 transition-all rounded-xl font-bold"><SelectValue /></SelectTrigger>
                                                            <SelectContent className="border-none shadow-xl rounded-xl">
                                                                {Object.keys(currencySymbols).map(c => <SelectItem key={c} value={c} className="font-bold">{c}</SelectItem>)}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ))}
                                        <Button onClick={addActivity} variant="outline" className="w-full h-12 border-dashed border-2 hover:border-primary hover:bg-primary/5 text-primary font-black uppercase tracking-widest rounded-xl transition-all">
                                            <PlusCircle className="mr-2 h-5 w-5" />
                                            ເພີ່ມກິດຈະກຳ
                                        </Button>
                                    </div>
                                </CostCategoryContent>
                            </Accordion>
                            <div className="flex justify-between pt-6 print:hidden">
                                <Button variant="outline" onClick={() => setActiveTab('info')} className="rounded-full px-6 h-10 font-black text-sm border-2 transition-all">
                                    <ArrowLeft className="mr-2 h-4 w-4" />
                                    ກັບຄືນ
                                </Button>
                                <Button onClick={() => setActiveTab('grand_totals')} className="rounded-full px-6 h-10 font-black text-sm shadow-lg shadow-primary/20 hover:shadow-xl transition-all">
                                    ຕໍ່ໄປ: ລວມຍອດຕົ້ນທຶນ
                                    <ArrowRight className="ml-2 h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </TabsContent>

                                <TabsContent value="grand_totals" className="space-y-10 mt-0 outline-none">
                                    {/* Grand Totals Section */}
                                    <div className="max-w-3xl mx-auto w-full">
                                        <Card className="border-none shadow-soft rounded-[2rem] bg-white overflow-hidden">
                                            <CardHeader className="pb-4 pt-6 px-6 border-b bg-muted/5">
                                                <CardTitle className="text-lg font-black tracking-tight flex items-center gap-3">
                                                    <div className="p-1.5 bg-primary/10 rounded-lg text-primary">
                                                        <Calculator className="h-4 w-4" />
                                                    </div>
                                                    ລວມຍອດຕົ້ນທຶນ (Grand Totals)
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent className="p-8">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                    {(Object.keys(grandTotals) as Currency[]).map(currency => (
                                                        <div key={currency} className="p-8 rounded-3xl bg-muted/30 border border-transparent hover:border-primary/20 transition-all hover:shadow-md group">
                                                            <p className="text-xs font-black uppercase tracking-[0.2em] text-foreground mb-3 group-hover:text-primary transition-colors">{currency}</p>
                                                            <p className="text-4xl font-black tracking-tighter">{formatNumber(grandTotals[currency])}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </div>
                                    <div className="flex justify-between pt-6 print:hidden">
                                        <Button variant="outline" onClick={() => setActiveTab('costs')} className="rounded-full px-6 h-10 font-black text-sm border-2 transition-all">
                                            <ArrowLeft className="mr-2 h-4 w-4" />
                                            ກັບຄືນ
                                        </Button>
                                        <Button onClick={() => setActiveTab('category_totals')} className="rounded-full px-6 h-10 font-black text-sm shadow-lg shadow-primary/20 hover:shadow-xl transition-all">
                                            ຕໍ່ໄປ: ລາຍລະອຽດຕົ້ນທຶນ
                                            <ArrowRight className="ml-2 h-4 w-4" />
                                        </Button>
                                    </div>
                                </TabsContent>

                                <TabsContent value="category_totals" className="space-y-10 mt-0 outline-none">
                                    {/* Category Totals Section */}
                                    <div className="max-w-4xl mx-auto w-full">
                                        <TotalCostCard totalsByCategory={totalsByCategory} />
                                    </div>
                                    <div className="flex justify-between pt-6 print:hidden">
                                        <Button variant="outline" onClick={() => setActiveTab('grand_totals')} className="rounded-full px-6 h-10 font-black text-sm border-2 transition-all">
                                            <ArrowLeft className="mr-2 h-4 w-4" />
                                            ກັບຄືນ
                                        </Button>
                                        <Button onClick={() => setActiveTab('calculation_summary')} className="rounded-full px-6 h-10 font-black text-sm shadow-lg shadow-primary/20 hover:shadow-xl transition-all">
                                            ຕໍ່ໄປ: ສະຫຼຸບການຄຳນວນ
                                            <ArrowRight className="ml-2 h-4 w-4" />
                                        </Button>
                                    </div>
                                </TabsContent>

                                <TabsContent value="calculation_summary" className="space-y-10 mt-0 outline-none">
                                    {/* Calculation Summary Section */}
                                    <div className="max-w-3xl mx-auto w-full">
                                        <ExchangeRateCard 
                                            totalCost={grandTotals} 
                                            rates={exchangeRates} 
                                            onRatesChange={setExchangeRates}
                                            profitPercentage={profitPercentage}
                                            onProfitPercentageChange={setProfitPercentage}
                                            numPeople={tourInfo.numPeople}
                                        />
                                    </div>
                                    <div className="flex justify-between pt-6 print:hidden">
                                        <Button variant="outline" onClick={() => setActiveTab('category_totals')} className="rounded-full px-6 h-10 font-black text-sm border-2 transition-all">
                                            <ArrowLeft className="mr-2 h-4 w-4" />
                                            ກັບຄືນ
                                        </Button>
                                        <Button onClick={handleSaveCalculation} className="rounded-full px-6 h-10 font-black text-sm shadow-lg shadow-primary/20 hover:shadow-xl transition-all">
                                            <Save className="mr-2 h-4 w-4" />
                                            ບັນທຶກຂໍ້ມູນ
                                        </Button>
                                    </div>
                                </TabsContent>
                            </div>
                        </Tabs>
                    </div>
                </div>
            </main>
        </div>
    );
}
