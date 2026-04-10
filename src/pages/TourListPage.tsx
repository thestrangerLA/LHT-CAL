import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlusCircle, Calculator, MoreHorizontal, Search, ArrowLeft, MapPin, FileText, Users, TrendingUp, Globe, LogIn, LogOut, User as UserIcon } from 'lucide-react';
import { toast } from "sonner";
import { collection, query, orderBy, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SavedCalculation } from '@/types';
import { useAuth } from '@/contexts/AuthContext';

export default function TourCostCalculatorListPage() {
    const navigate = useNavigate();
    const { user, login, logout } = useAuth();
    const [savedCalculations, setSavedCalculations] = useState<SavedCalculation[]>([]);
    const [calculationsLoading, setCalculationsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

    useEffect(() => {
        if (!user) return;
        setCalculationsLoading(true);
        const toursColRef = collection(db, 'tourCalculations');
        
        // Admin can see everything, others only their own
        const isAdmin = user.email?.toLowerCase().trim() === "laohugtravelwork@gmail.com";
        
        let q;
        if (isAdmin) {
            // No where filter for admin to see all data
            q = query(toursColRef);
        } else {
            // Remove orderBy from Firestore query to avoid hiding documents missing the createdAt field
            // We will sort manually in memory instead
            q = query(
                toursColRef, 
                where('uid', '==', user.uid)
            );
        }

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const calcs = snapshot.docs.map(doc => {
                const data = doc.data();
                return { 
                    id: doc.id, 
                    ...data,
                    // Handle legacy data structure
                    costs: data.costs || data.allCosts || {
                        accommodations: [], trips: [], flights: [], trainTickets: [],
                        entranceFees: [], meals: [], guides: [], documents: [], overseasPackages: [], activities: []
                    }
                } as SavedCalculation;
            });
            
            // Sort manually for everyone to ensure consistency and handle missing fields
            calcs.sort((a, b) => {
                const dateA = a.createdAt || a.savedAt || 0;
                const dateB = b.createdAt || b.savedAt || 0;
                
                // Helper to get numeric time
                const getTime = (val: any) => {
                    if (!val) return 0;
                    if (typeof val === 'object' && 'toMillis' in val) return val.toMillis();
                    if (val instanceof Date) return val.getTime();
                    const d = new Date(val);
                    return isNaN(d.getTime()) ? 0 : d.getTime();
                };

                return getTime(dateB) - getTime(dateA);
            });
            
            setSavedCalculations(calcs);
            setCalculationsLoading(false);
        }, (error) => {
            handleFirestoreError(error, OperationType.LIST, 'tourCalculations');
        });

        return () => unsubscribe();
    }, [user]);

    const filteredCalculations = useMemo(() => {
        return savedCalculations.filter(calc => {
            const name = calc.name?.toLowerCase() || '';
            const groupCode = calc.tourInfo?.groupCode?.toLowerCase() || '';
            return name.includes(searchQuery.toLowerCase()) || 
                   groupCode.includes(searchQuery.toLowerCase());
        }).sort((a, b) => {
            const nameA = a.name || '';
            const nameB = b.name || '';
            return nameB.localeCompare(nameA);
        });
    }, [savedCalculations, searchQuery]);

    const handleAddNewCalculation = async () => {
        if (!user) return;
        const newCalculationData = {
            uid: user.uid,
            createdAt: serverTimestamp(),
            name: `โปรแกรมใหม่ ${new Date().toLocaleDateString()}`,
            days: 1,
            markupPercentage: 15,
            markupAmount: 0,
            exchangeRates: {
                USD: { THB: 38, LAK: 25000, CNY: 8, USD: 1 },
                THB: { USD: 0.032, LAK: 700, CNY: 0.25, THB: 1 },
                CNY: { USD: 0.20, THB: 6, LAK: 3500, CNY: 1 },
                LAK: { USD: 0.00005, THB: 0.0015, CNY: 0.00035, LAK: 1 },
            },
            costs: {
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
            }
        };
        
        try {
            const toursColRef = collection(db, 'tourCalculations');
            const newDocRef = await addDoc(toursColRef, newCalculationData);
            if(newDocRef){
              navigate(`/tour/cost-calculator/${newDocRef.id}`);
            }
        } catch (error) {
            handleFirestoreError(error, OperationType.CREATE, 'tourCalculations');
        }
    };
    
    const handleDeleteCalculation = async (id: string) => {
        try {
            const docRef = doc(db, 'tourCalculations', id);
            await deleteDoc(docRef);
            toast.success("ลบข้อมูลสำเร็จ");
            setIsDeleteDialogOpen(false);
            setDeleteId(null);
        } catch (error) {
            handleFirestoreError(error, OperationType.DELETE, `tourCalculations/${id}`);
        }
    };

    const confirmDelete = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setDeleteId(id);
        setIsDeleteDialogOpen(true);
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
                                placeholder="ค้นหารหัสกลุ่ม, ปลายทาง, โปรแกรม..."
                                className="pl-12 w-full bg-white border-black/10 focus:bg-white h-12 rounded-2xl transition-all"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        {user && !user.isAnonymous ? (
                            <div className="flex items-center gap-3 mr-2">
                                <div className="hidden lg:block text-right">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-black/40">Logged in as</p>
                                    <div className="flex items-center gap-2">
                                        {user.email?.toLowerCase().trim() === "laohugtravelwork@gmail.com" && (
                                            <span className="bg-black text-white text-[8px] px-1.5 py-0.5 rounded font-black uppercase tracking-tighter">Admin</span>
                                        )}
                                        <p className="text-xs font-bold text-black">{user.email}</p>
                                    </div>
                                </div>
                                <Button variant="ghost" size="icon" onClick={logout} className="h-12 w-12 rounded-2xl hover:bg-red-50 hover:text-red-600 transition-all">
                                    <LogOut className="h-5 w-5" />
                                </Button>
                            </div>
                        ) : (
                            <Button variant="outline" onClick={login} className="h-12 rounded-2xl px-6 font-black border-black/10 hover:bg-black hover:text-white transition-all">
                                <LogIn className="mr-2 h-5 w-5" />
                                เข้าสู่ระบบ
                            </Button>
                        )}
                        <Button onClick={handleAddNewCalculation} className="h-12 rounded-2xl px-8 font-black shadow-xl shadow-black/10 hover:shadow-2xl hover:shadow-black/20 transition-all active:scale-95 bg-black text-white">
                            <PlusCircle className="mr-2 h-5 w-5" />
                            เพิ่มใหม่
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
                                    <h2 className="text-3xl font-black tracking-tight">รายการทั้งหมด</h2>
                                    <p className="text-muted-foreground font-medium">จัดการข้อมูลการคำนวณต้นทุนทัวร์ของคุณ</p>
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
                                                                <DropdownMenuItem onSelect={() => navigate(`/tour/cost-calculator/${calc.id}`)} className="rounded-xl h-10 font-bold hover:bg-black hover:text-white">แก้ไขข้อมูล</DropdownMenuItem>
                                                                <DropdownMenuItem onSelect={(e) => confirmDelete(e as any, calc.id)} className="text-red-600 rounded-xl h-10 font-bold hover:bg-red-600 hover:text-white">ลบออก</DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </div>
                                                    
                                                    <div className="space-y-5">
                                                        <div className="flex items-center gap-4 text-sm font-bold text-black/80">
                                                            <div className="p-2.5 rounded-xl bg-black text-white transition-all duration-500">
                                                                <MapPin className="h-4 w-4" />
                                                            </div>
                                                            <span className="truncate">{calc.tourInfo?.destinationCountry || 'ไม่ระบุจุดหมาย'}</span>
                                                        </div>
                                                        <div className="flex items-center gap-4 text-sm font-bold text-black/80">
                                                            <div className="p-2.5 rounded-xl bg-black text-white transition-all duration-500">
                                                                <FileText className="h-4 w-4" />
                                                            </div>
                                                            <span className="truncate">{calc.tourInfo?.program || 'ไม่มีโปรแกรม'}</span>
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="mt-10 pt-8 border-t border-muted/50 flex items-center justify-between">
                                                        <div className="flex items-center gap-3 px-4 py-2 rounded-2xl bg-black/5 text-black">
                                                            <Users className="h-4 w-4" />
                                                            <span className="text-xs font-black">{calc.tourInfo?.numPeople || 0} คน</span>
                                                        </div>
                                                        <div className="flex items-center gap-2 text-xs font-black text-black group-hover:gap-4 transition-all">
                                                            ดูรายละเอียด
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
                                            <h3 className="text-3xl font-black mb-3 tracking-tight">ไม่พบข้อมูลการคำนวณ</h3>
                                            <p className="text-muted-foreground mb-10 max-w-md mx-auto font-medium">ลองเปลี่ยนเงื่อนไขการค้นหา หรือ เพิ่มการคำนวณใหม่เพื่อเริ่มต้นการวางแผนทัวร์ของคุณ</p>
                                            <Button onClick={handleAddNewCalculation} size="lg" className="h-14 rounded-2xl px-10 font-black shadow-xl shadow-black/20 bg-black text-white">
                                                <PlusCircle className="mr-3 h-6 w-6" />
                                                เพิ่มการคำนวณใหม่
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </main>
            </div>

            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent className="rounded-[2rem] border-none shadow-premium p-10 max-w-md">
                    <AlertDialogHeader className="space-y-4">
                        <AlertDialogTitle className="text-2xl font-black tracking-tight">ยืนยันการลบข้อมูล?</AlertDialogTitle>
                        <AlertDialogDescription className="text-muted-foreground font-medium">
                            คุณแน่ใจหรือไม่ว่าต้องการลบข้อมูลการคำนวณนี้? การดำเนินการนี้ไม่สามารถย้อนกลับได้
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="mt-10 gap-4">
                        <AlertDialogCancel 
                            variant="outline"
                            size="default"
                            className="h-12 rounded-2xl px-6 font-black border-black/10 hover:bg-black/5 transition-all"
                        >
                            ยกเลิก
                        </AlertDialogCancel>
                        <AlertDialogAction 
                            variant="destructive"
                            size="default"
                            onClick={() => deleteId && handleDeleteCalculation(deleteId)}
                            className="h-12 rounded-2xl px-6 font-black bg-red-600 hover:bg-red-700 text-white shadow-xl shadow-red-600/20 transition-all"
                        >
                            ยืนยันการลบ
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
