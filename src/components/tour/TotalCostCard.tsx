import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Currency } from "@/types";
import { PieChart, BedDouble, Truck, Plane, TrainFront, UtensilsCrossed, Users, FileText, Globe, Bike, LayoutGrid, Calculator } from "lucide-react";

const currencySymbols: Record<Currency, string> = {
    USD: '$',
    THB: '฿',
    LAK: '₭',
    CNY: '¥',
};

const categoryIcons: Record<string, any> = {
    'accommodations': BedDouble,
    'trips': Truck,
    'flights': Plane,
    'trainTickets': TrainFront,
    'entranceFees': Globe,
    'meals': UtensilsCrossed,
    'guides': Users,
    'documents': FileText,
    'overseasPackages': Globe,
    'activities': Bike,
};

const categoryNames: Record<string, string> = {
    'accommodations': 'ຄ່າທີ່ພັກ',
    'trips': 'ຄ່າຂົນສົ່ງ',
    'flights': 'ຄ່າປີ້ຍົນ',
    'trainTickets': 'ຄ່າປີ້ລົດໄຟ',
    'entranceFees': 'ຄ່າເຂົ້າຊົມ',
    'meals': 'ຄ່າອາຫານ',
    'guides': 'ຄ່າໄກ້',
    'documents': 'ຄ່າເອກະສານ',
    'overseasPackages': 'ແພັກເກັດຕ່າງປະເທດ',
    'activities': 'ຄ່າກິດຈະກຳ',
};

const formatNumber = (num: number) => new Intl.NumberFormat('en-US').format(num);

export function TotalCostCard({ totalsByCategory }: { totalsByCategory: Record<string, Record<Currency, number>> }) {
    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-green-500/10 rounded-xl text-green-600">
                    <Calculator className="h-5 w-5" />
                </div>
                <h2 className="text-xl font-black tracking-tight text-foreground">ສະຫຼຸບຕາມໝວດໝູ່</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(totalsByCategory).map(([category, totals]) => {
                    const filteredTotals = Object.entries(totals).filter(([, value]) => value > 0);
                    if (filteredTotals.length === 0) return null;
                    
                    const Icon = categoryIcons[category] || PieChart;
                    const name = categoryNames[category] || category;
                    
                    return (
                        <Card key={category} className="border-none shadow-sm rounded-2xl bg-card overflow-hidden hover:shadow-md transition-all group border border-border/50">
                            <CardContent className="p-5 flex items-center gap-5">
                                <div className="p-4 bg-green-500/10 rounded-full text-green-600 group-hover:scale-110 transition-transform duration-500">
                                    <Icon className="h-6 w-6" />
                                </div>
                                <div className="flex-1 space-y-1">
                                    <p className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-widest">{name}</p>
                                    <div className="flex flex-col">
                                        {filteredTotals.map(([currency, value]) => (
                                            <div key={currency} className="flex items-baseline gap-1">
                                                <span className="text-lg font-black tracking-tight text-foreground">
                                                    {currencySymbols[currency as Currency]}{formatNumber(Math.round(value))}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}
