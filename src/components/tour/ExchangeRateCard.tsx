import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Currency, ExchangeRates } from "@/types";
import { TrendingUp, Calculator, ArrowRightLeft, RefreshCw } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const formatNumber = (num: number) => new Intl.NumberFormat('en-US').format(num);

export function ExchangeRateCard({ 
    totalCost, 
    rates, 
    onRatesChange,
    profitPercentage,
    onProfitPercentageChange,
    numPeople
}: { 
    totalCost: Record<Currency, number>; 
    rates: ExchangeRates; 
    onRatesChange: (rates: ExchangeRates) => void;
    profitPercentage: number;
    onProfitPercentageChange: (val: number) => void;
    numPeople: number;
}) {
    const [selectedCurrency, setSelectedCurrency] = useState<Currency>('LAK');

    const handleRateChange = (from: Currency, to: Currency, value: string) => {
        const numValue = parseFloat(value) || 0;
        const newRates = { ...rates };
        newRates[from] = { ...newRates[from], [to]: numValue };
        onRatesChange(newRates);
    };

    const calculateTotalInSelected = () => {
        let total = totalCost[selectedCurrency];
        (Object.keys(totalCost) as Currency[]).forEach(curr => {
            if (curr !== selectedCurrency) {
                total += totalCost[curr] * (rates[curr]?.[selectedCurrency] || 0);
            }
        });
        return total;
    };

    const totalInSelected = calculateTotalInSelected();
    const costPerPerson = totalInSelected / (numPeople || 1);
    const totalWithProfit = totalInSelected * (1 + profitPercentage / 100);
    const profitAmount = totalWithProfit - totalInSelected;

    const currencies: Currency[] = ['USD', 'THB', 'CNY', 'LAK'];

    return (
        <div className="space-y-10">
            {/* Calculation Summary Section */}
            <Card className="border-none shadow-soft rounded-[2rem] bg-white overflow-hidden relative group">
                <CardHeader className="pb-4 pt-8 px-8 border-b bg-muted/5">
                    <div className="flex items-center justify-between mb-6">
                        <CardTitle className="text-2xl font-black tracking-tight text-foreground">
                            ສະຫຼຸບການຄຳນວນ
                        </CardTitle>
                        <div className="p-2 bg-primary/10 rounded-xl text-primary">
                            <Calculator className="h-5 w-5" />
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="space-y-3">
                            <Label className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-[0.2em]">ເລືອກສະກຸນເງິນສະຫຼຸບ</Label>
                            <Tabs value={selectedCurrency} onValueChange={(val) => setSelectedCurrency(val as Currency)} className="w-full">
                                <TabsList className="grid grid-cols-4 bg-muted/30 p-1 rounded-2xl h-12 border border-transparent">
                                    {currencies.map(curr => (
                                        <TabsTrigger key={curr} value={curr} className="rounded-xl font-black text-xs data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all">{curr}</TabsTrigger>
                                    ))}
                                </TabsList>
                            </Tabs>
                        </div>

                        <div className="space-y-1 pt-2">
                            <p className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-[0.2em]">ຕົ້ນທຶນລວມ (TOTAL COST)</p>
                            <div className="flex items-baseline gap-3">
                                <span className="text-5xl font-black tracking-tighter text-foreground">{formatNumber(Math.round(totalInSelected))}</span>
                                <span className="text-xl font-black text-primary">{selectedCurrency}</span>
                            </div>
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="p-8 space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-3">
                            <Label className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-wider">ຕົ້ນທຶນ/ຄົນ</Label>
                            <div className="h-14 bg-muted/20 rounded-2xl flex items-center px-5 border border-transparent shadow-inner">
                                <span className="text-2xl font-black tracking-tight text-foreground">{formatNumber(Math.round(costPerPerson))}</span>
                                <span className="ml-2 text-sm font-bold text-muted-foreground">{selectedCurrency}</span>
                            </div>
                        </div>
                        <div className="space-y-3">
                            <Label className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-wider">ກຳໄລຄາດໝາຍ (%)</Label>
                            <Input 
                                type="number" 
                                value={profitPercentage} 
                                onChange={e => onProfitPercentageChange(parseFloat(e.target.value) || 0)} 
                                className="h-14 bg-muted/20 border-transparent focus:bg-white focus:ring-2 focus:ring-primary/20 transition-all rounded-2xl font-black text-2xl text-foreground text-center shadow-inner" 
                            />
                        </div>
                    </div>

                    <div className="space-y-4">
                        <Label className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-wider">ລາຄາຂາຍລວມ (TOTAL SELLING)</Label>
                        <div className="relative">
                            <div className="h-20 bg-primary/5 rounded-2xl flex items-center px-8 border-2 border-primary/10 group-focus-within:bg-primary/10 transition-all shadow-sm">
                                <span className="text-4xl font-black tracking-tight text-primary">{formatNumber(Math.round(totalWithProfit))}</span>
                            </div>
                            <div className="absolute right-8 top-1/2 -translate-y-1/2 text-xl font-black text-primary/40">
                                {selectedCurrency}
                            </div>
                        </div>
                    </div>

                    <div className="bg-green-500/5 p-8 rounded-[2rem] border border-green-500/10 flex justify-between items-center shadow-sm">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-green-500/10 rounded-2xl text-green-600">
                                <TrendingUp className="h-6 w-6" />
                            </div>
                            <div>
                                <span className="text-xl font-black text-foreground block">ກຳໄລສຸດທິ</span>
                                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Net Profit</span>
                            </div>
                        </div>
                        <span className="text-3xl font-black tracking-tight text-green-600">
                            {formatNumber(Math.round(profitAmount))} <span className="text-lg">{selectedCurrency}</span>
                        </span>
                    </div>
                </CardContent>
            </Card>

            {/* Exchange Rates Grid Section */}
            <div className="space-y-6">
                <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-xl text-primary">
                            <ArrowRightLeft className="h-5 w-5" />
                        </div>
                        <h2 className="text-2xl font-black tracking-tight text-foreground">ອັດຕາແລກປ່ຽນ</h2>
                    </div>
                    <p className="text-sm font-bold text-muted-foreground ml-11">ລະບົບຈະບັນທຶກອັດຕະໂນມັດເມື່ອມີການປ່ຽນແປງ</p>
                </div>

                <div className="grid grid-cols-1 gap-4">
                    {currencies.map(from => (
                        <Card key={from} className="border-none shadow-sm rounded-2xl bg-white overflow-hidden border border-border/50">
                            <CardContent className="p-6 flex flex-col md:flex-row items-center gap-6">
                                <div className="flex items-center gap-3 min-w-[120px]">
                                    <span className="text-lg font-black text-foreground">1 {from} =</span>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1 w-full">
                                    {currencies.filter(to => to !== from).map(to => (
                                        <div key={to} className="relative group">
                                            <Input 
                                                type="number" 
                                                value={rates[from][to]} 
                                                onChange={e => handleRateChange(from, to, e.target.value)}
                                                className="h-12 pr-12 bg-muted/30 border-transparent focus:bg-white focus:ring-2 focus:ring-primary/20 transition-all rounded-xl font-black text-lg text-foreground shadow-inner"
                                            />
                                            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black text-muted-foreground/60 uppercase tracking-widest">
                                                {to}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        </div>
    );
}
