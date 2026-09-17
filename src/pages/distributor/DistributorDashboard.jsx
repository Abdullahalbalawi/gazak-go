import React,{useEffect,useState} from "react";
import {Link} from "react-router-dom";
import {supabase} from "@/lib/supabaseClient";
import {useAuth} from "@/lib/AuthContext";
import {DEMO_MODE,getDemoOrders} from "@/lib/demoMode";
import StaffHeader from "@/components/StaffHeader";
import StatusBadge from "@/components/StatusBadge";
import {Loader2,ChevronLeft,Inbox} from "lucide-react";
import {cn} from "@/lib/utils";

const TABS=[{key:"NEW",label:"جديد",statuses:["NEW"]},{key:"PREPARING",label:"قيد التجهيز",statuses:["ACCEPTED","PREPARING"]},{key:"READY",label:"جاهز",statuses:["READY","ASSIGNED"]},{key:"DELIVERED",label:"مكتمل",statuses:["DELIVERED"]}];
export default function DistributorDashboard(){const{user}=useAuth();const[activeTab,setActiveTab]=useState("NEW");const[orders,setOrders]=useState([]);const[loading,setLoading]=useState(true);
const normalize=(list)=>list.map(o=>({...o,order_items:o.order_items||o.items||[]}));
const fetchOrders=async()=>{if(!user?.id)return;try{if(DEMO_MODE){setOrders(normalize(getDemoOrders()));return}const{data,error}=await supabase.from("orders").select("*, order_items(*)").order("created_at",{ascending:false}).limit(100);if(error)throw error;setOrders(data||[])}catch(e){console.error(e)}finally{setLoading(false)}};
useEffect(()=>{fetchOrders();if(DEMO_MODE)return undefined;const channel=supabase.channel(`distributor-orders-${user?.id}`).on("postgres_changes",{event:"*",schema:"public",table:"orders"},fetchOrders).subscribe();return()=>supabase.removeChannel(channel)},[user?.id]);
const tab=TABS.find(t=>t.key===activeTab);const filtered=orders.filter(o=>tab.statuses.includes(o.status));
return <div className="min-h-screen bg-gray-50"><StaffHeader title="لوحة الموزع"/><div className="sticky top-14 z-30 bg-white border-b border-border"><div className="max-w-3xl mx-auto flex overflow-x-auto">{TABS.map(t=>{const count=orders.filter(o=>t.statuses.includes(o.status)).length;return <button key={t.key} onClick={()=>setActiveTab(t.key)} className={cn("flex-1 min-w-[80px] py-3 text-sm font-medium border-b-2 whitespace-nowrap",activeTab===t.key?"border-primary text-primary":"border-transparent text-muted-foreground")}>{t.label}{count>0&&<span className="mr-1.5 text-xs rounded-full px-1.5 py-0.5 bg-muted">{count}</span>}</button>})}</div></div><div className="max-w-3xl mx-auto px-4 py-4">{loading?<div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin"/></div>:filtered.length===0?<div className="flex flex-col items-center py-16 text-muted-foreground"><Inbox className="w-14 h-14 mb-3"/><p className="font-medium">لا توجد طلبات في هذا التبويب</p></div>:<div className="space-y-3">{filtered.map(order=><Link key={order.id} to={`/distributor/order/${order.id}`} className="block bg-white rounded-2xl border border-border p-4"><div className="flex items-start justify-between mb-2"><div><p className="font-mono text-xs text-muted-foreground">#{order.id.slice(-8).toUpperCase()}</p><p className="font-semibold text-sm mt-0.5">{order.customer_name}</p><p className="text-xs text-muted-foreground">{order.customer_phone}</p></div><StatusBadge status={order.status}/></div><div className="flex items-center justify-between mt-2 pt-2 border-t border-border"><span className="text-xs text-muted-foreground">{order.order_items?.length||0} منتج · {order.total} ر.س</span><span className="inline-flex items-center text-xs text-primary font-medium">فتح <ChevronLeft className="w-4 h-4"/></span></div></Link>)}</div>}</div></div>;
}
