import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlusCircle, Calculator, MoreHorizontal, Search, ArrowLeft, MapPin, FileText, Users, TrendingUp, Globe } from 'lucide-react';
import { toast } from "sonner";
import { collection, query, orderBy, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { SavedCalculation } from '@/types';
import { useAuth } from '@/contexts/AuthContext';

export default function TourCostCalculatorListPage() {
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const [savedCalculations, setSavedCalculations] = useState<SavedCalculation[]>([]);
    const [calculationsLoading, setCalculationsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        if (!user) return;
        setCalculationsLoading(true);
        const toursColRef = collection(db, 'tours');
        const q = query(
            toursColRef, 
            orderBy('savedAt', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const calcs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SavedCalculation));
            setSavedCalculations(calcs);
            setCalculationsLoading(false);
        }, (error) => {
            handleFirestoreError(error, OperationType.LIST, 'tours');
        });

        return () => unsubscribe();
    }, [user]);

    const filteredCalculations = useMemo(() => {
        return savedCalculations.filter(calc => {
            const groupCode = calc.tourInfo?.groupCode?.toLowerCase() || '';
            const program = calc.tourInfo?.program?.toLowerCase() || '';
            const destination = calc.tourInfo?.destinationCountry?.toLowerCase() || '';
            return groupCode.includes(searchQuery.toLowerCase()) || 
                   program.includes(searchQuery.toLowerCase()) ||
                   destination.includes(searchQuery.toLowerCase());
        }).sort((a, b) => {
            const tourCodeA = a.tourInfo?.groupCode || '';
            const tourCodeB = b.tourInfo?.groupCode || '';
            return tourCodeB.localeCompare(tourCodeA);
        });
    }, [savedCalculations, searchQuery]);

    const handleAddNewCalculation = async () => {
        if (!user) return;
        const newCalculationData = {
            uid: user.uid,
            savedAt: serverTimestamp(),
            tourInfo: {
                mouContact: '',
                groupCode: `LTH${Date.now()}`,
                destinationCountry: '',
                program: '',
                startDate: null,
                endDate: null,
                numDays: 1,
                numNights: 0,
                numPeople: 1,
                travelerInfo: ''
            },
            allCosts: {
                accommodations: [],
                trips: [],
                flights: [],
                trainTickets: [],
                entranceFees: [],
                meals: [],
                guides: [],
                documents: [],
                overseasPackages: [],
                activities: []
            },
            exchangeRates: {
                USD: { THB: 38, LAK: 25000, CNY: 8, USD: 1 },
                THB: { USD: 0.032, LAK: 700, CNY: 0.25, THB: 1 },
                CNY: { USD: 0.20, THB: 6, LAK: 3500, CNY: 1 },
                LAK: { USD: 0.00005, THB: 0.0015, CNY: 0.00035, LAK: 1 },
            },
            profitPercentage: 20
        };
        
        try {
            const toursColRef = collection(db, 'tours');
            const newDocRef = await addDoc(toursColRef, newCalculationData);
            if(newDocRef){
              navigate(`/tour/cost-calculator/${newDocRef.id}`);
            }
        } catch (error) {
            handleFirestoreError(error, OperationType.CREATE, 'tours');
        }
    };
    
    const handleDeleteCalculation = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (window.confirm("ທ່ານແນ່ໃຈບໍ່ວ່າຕ້ອງການລຶບຂໍ້ມູນການຄຳນວນນີ້?")) {
            try {
                const docRef = doc(db, 'tours', id);
                await deleteDoc(docRef);
                toast.success("ລຶບຂໍ້ມູນສຳເລັດ");
            } catch (error) {
                handleFirestoreError(error, OperationType.DELETE, `tours/${id}`);
            }
        }
    };

    const handleRowClick = (id: string) => {
        navigate(`/tour/cost-calculator/${id}`);
    };

    const stats = useMemo(() => {
        const totalPeople = savedCalculations.reduce((acc, calc) => acc + (calc.tourInfo?.numPeople || 0), 0);
        const destinations = new Set(savedCalculations.map(calc => calc.tourInfo?.destinationCountry).filter(Boolean));
        return {
            total: savedCalculations.length,
            people: totalPeople,
            destinations: destinations.size
        };
    }, [savedCalculations]);

    return (
        <div className="flex min-h-screen w-full bg-white">
            <div className="flex-1 flex flex-col min-w-0">
                <header className="sticky top-0 z-30 flex h-20 items-center gap-4 bg-white px-6 backdrop-blur-xl sm:px-10 border-b">
                    <div className="flex-1 flex items-center gap-4">
                        <div className="relative hidden md:block flex-1 max-w-md">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="search"
                                placeholder="ຄົ້ນຫາລະຫັດກຸ່ມ, ປາຍທາງ, ໂປຣແກຣມ..."
                                className="pl-12 w-full bg-white border-black/10 focus:bg-white h-12 rounded-2xl transition-all"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <Button onClick={handleAddNewCalculation} className="h-12 rounded-2xl px-8 font-black shadow-xl shadow-black/10 hover:shadow-2xl hover:shadow-black/20 transition-all active:scale-95 bg-black text-white">
                            <PlusCircle className="mr-2 h-5 w-5" />
                            ເພີ່ມໃໝ່
                        </Button>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto p-6 sm:px-10 sm:py-12">
                    <div className="w-full max-w-screen-2xl mx-auto space-y-12">
                        {/* Stats Section */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <Card className="border border-black/5 shadow-soft rounded-[2rem] bg-white p-8 group hover:shadow-premium transition-all">
                                <div className="flex items-center gap-6">
                                    <div className="p-4 rounded-2xl bg-black text-white transition-all duration-500">
                                        <Calculator className="h-8 w-8" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-black/40 mb-1">Total Calculations</p>
                                        <h3 className="text-3xl font-black tracking-tighter text-black">{stats.total}</h3>
                                    </div>
                                </div>
                            </Card>
                            <Card className="border border-black/5 shadow-soft rounded-[2rem] bg-white p-8 group hover:shadow-premium transition-all">
                                <div className="flex items-center gap-6">
                                    <div className="p-4 rounded-2xl bg-black text-white transition-all duration-500">
                                        <Users className="h-8 w-8" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-black/40 mb-1">Total Travelers</p>
                                        <h3 className="text-3xl font-black tracking-tighter text-black">{stats.people}</h3>
                                    </div>
                                </div>
                            </Card>
                            <Card className="border border-black/5 shadow-soft rounded-[2rem] bg-white p-8 group hover:shadow-premium transition-all">
                                <div className="flex items-center gap-6">
                                    <div className="p-4 rounded-2xl bg-black text-white transition-all duration-500">
                                        <Globe className="h-8 w-8" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-black/40 mb-1">Destinations</p>
                                        <h3 className="text-3xl font-black tracking-tighter text-black">{stats.destinations}</h3>
                                    </div>
                                </div>
                            </Card>
                        </div>

                        <div className="space-y-8">
                            <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                    <h2 className="text-3xl font-black tracking-tight">ລາຍການທັງໝົດ</h2>
                                    <p className="text-muted-foreground font-medium">ຈັດການຂໍ້ມູນການຄຳນວນຕົ້ນທຶນທົວຂອງທ່ານ</p>
                                </div>
                                <div className="flex items-center gap-2 text-sm font-bold text-muted-foreground bg-white px-4 py-2 rounded-xl shadow-sm">
                                    <TrendingUp className="h-4 w-4 text-black" />
                                    {filteredCalculations.length} items found
                                </div>
                            </div>

                            {calculationsLoading ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-8">
                                    {[1,2,3,4,5,6].map(i => (
                                        <Card key={i} className="animate-pulse h-64 bg-white border-none rounded-[2rem] shadow-soft" />
                                    ))}
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-8">
                                    {filteredCalculations.length > 0 ? filteredCalculations.map(calc => {
                                        return (
                                            <Card 
                                                key={calc.id} 
                                                className="group relative overflow-hidden border border-black/5 bg-white shadow-soft hover:shadow-premium rounded-[2rem] cursor-pointer transition-all duration-500 hover:-translate-y-2"
                                                onClick={() => handleRowClick(calc.id)}
                                            >
                                                <div className="absolute top-0 left-0 w-full h-2 bg-black/5 group-hover:bg-black transition-colors duration-500" />
                                                <CardContent className="p-8">
                                                    <div className="flex justify-between items-start mb-8">
                                                        <div className="space-y-2">
                                                            <div className="flex items-center gap-2">
                                                                <div className="h-2 w-2 rounded-full bg-black/40 group-hover:bg-black transition-colors" />
                                                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-black/40 group-hover:text-black/60 transition-colors">
                                                                    SAVED CALCULATION
                                                                </p>
                                                            </div>
                                                            <h3 className="font-black text-2xl tracking-tight leading-none group-hover:text-black transition-colors">
                                                                {calc.tourInfo?.groupCode || 'No Code'}
                                                            </h3>
                                                        </div>
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl hover:bg-black/5 transition-all" onClick={(e) => e.stopPropagation()}>
                                                                    <MoreHorizontal className="h-5 w-5" />
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end" className="rounded-2xl border border-black/5 shadow-premium p-2 min-w-[160px] bg-white">
                                                                <DropdownMenuItem onSelect={() => navigate(`/tour/cost-calculator/${calc.id}`)} className="rounded-xl h-10 font-bold hover:bg-black hover:text-white">ແກ້ໄຂຂໍ້ມູນ</DropdownMenuItem>
                                                                <DropdownMenuItem onSelect={(e) => handleDeleteCalculation(e as any, calc.id)} className="text-red-600 rounded-xl h-10 font-bold hover:bg-red-600 hover:text-white">ລຶບອອກ</DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </div>
                                                    
                                                    <div className="space-y-5">
                                                        <div className="flex items-center gap-4 text-sm font-bold text-black/80">
                                                            <div className="p-2.5 rounded-xl bg-black text-white transition-all duration-500">
                                                                <MapPin className="h-4 w-4" />
                                                            </div>
                                                            <span className="truncate">{calc.tourInfo?.destinationCountry || 'ບໍ່ລະບຸຈຸດໝາຍ'}</span>
                                                        </div>
                                                        <div className="flex items-center gap-4 text-sm font-bold text-black/80">
                                                            <div className="p-2.5 rounded-xl bg-black text-white transition-all duration-500">
                                                                <FileText className="h-4 w-4" />
                                                            </div>
                                                            <span className="truncate">{calc.tourInfo?.program || 'ບໍ່ມີໂປຣແກຣມ'}</span>
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="mt-10 pt-8 border-t border-muted/50 flex items-center justify-between">
                                                        <div className="flex items-center gap-3 px-4 py-2 rounded-2xl bg-black/5 text-black">
                                                            <Users className="h-4 w-4" />
                                                            <span className="text-xs font-black">{calc.tourInfo?.numPeople || 0} ຄົນ</span>
                                                        </div>
                                                        <div className="flex items-center gap-2 text-xs font-black text-black group-hover:gap-4 transition-all">
                                                            ເບິ່ງລາຍລະອຽດ
                                                            <ArrowLeft className="h-4 w-4 rotate-180" />
                                                        </div>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        );
                                    }) : (
                                        <div className="col-span-full py-40 text-center border-4 border-dashed rounded-[3rem] bg-white border-muted/20">
                                            <div className="inline-flex p-10 rounded-[2rem] bg-muted/10 mb-8">
                                                <Calculator className="h-20 w-20 text-muted-foreground/20" />
                                            </div>
                                            <h3 className="text-3xl font-black mb-3 tracking-tight">ບໍ່ພົບຂໍ້ມູນການຄຳນວນ</h3>
                                            <p className="text-muted-foreground mb-10 max-w-md mx-auto font-medium">ລອງປ່ຽນເງື່ອນໄຂການຄົ້ນຫາ ຫຼື ເພີ່ມການຄຳນວນໃໝ່ເພື່ອເລີ່ມຕົ້ນການວາງແຜນທົວຂອງທ່ານ</p>
                                            <Button onClick={handleAddNewCalculation} size="lg" className="h-14 rounded-2xl px-10 font-black shadow-xl shadow-black/20 bg-black text-white">
                                                <PlusCircle className="mr-3 h-6 w-6" />
                                                ເພີ່ມການຄຳນວນໃໝ່
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}
