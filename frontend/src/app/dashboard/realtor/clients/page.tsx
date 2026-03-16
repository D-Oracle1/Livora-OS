'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Users,
  Search,
  Plus,
  Mail,
  Phone,
  Home,
  MoreHorizontal,
  MessageSquare,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { formatCurrency } from '@/lib/utils';
import { api } from '@/lib/api';
import { NairaSign } from '@/components/icons/naira-sign';

export default function RealtorClientsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [clients, setClients] = useState<any[]>([]);

  const fetchClients = useCallback(async () => {
    try {
      const response: any = await api.get('/clients?limit=100');
      const payload = response.data || response;
      const records = Array.isArray(payload) ? payload : payload?.data || [];
      const mapped = records.map((c: any) => ({
        id: c.id,
        name: c.user ? `${c.user.firstName} ${c.user.lastName}` : 'Unknown',
        email: c.user?.email || '',
        phone: c.user?.phone || '',
        properties: c._count?.properties || 0,
        totalValue: 0,
        status: c.user?.status || 'ACTIVE',
        lastContact: '',
      }));
      setClients(mapped);
    } catch {
      // API unavailable, show empty state
    }
  }, []);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  const totalClients = clients.length;
  const activeClients = clients.filter(c => c.status === 'ACTIVE').length;
  const prospectiveClients = totalClients - activeClients;
  const portfolioValue = clients.reduce((sum: number, c: any) => sum + (c.totalValue || 0), 0);

  const stats = [
    { title: 'Total Clients', value: String(totalClients), icon: Users, color: 'text-blue-600', bgColor: 'bg-blue-100' },
    { title: 'Active Clients', value: String(activeClients), icon: Users, color: 'text-green-600', bgColor: 'bg-green-100' },
    { title: 'Prospective', value: String(prospectiveClients), icon: Users, color: 'text-orange-600', bgColor: 'bg-orange-100' },
    { title: 'Portfolio Value', value: formatCurrency(portfolioValue), icon: NairaSign, color: 'text-primary', bgColor: 'bg-primary/10' },
  ];

  const filteredClients = clients.filter((client: any) => {
    const matchesSearch = client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         client.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'ALL' || client.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card>
              <CardContent className="p-6">
                <div className={`inline-flex p-3 rounded-lg ${stat.bgColor} mb-4`}>
                  <stat.icon className={`w-6 h-6 ${stat.color}`} />
                </div>
                <h3 className="text-2xl font-bold">{stat.value}</h3>
                <p className="text-sm text-muted-foreground">{stat.title}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Clients List */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <Card>
          <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              My Clients
            </CardTitle>
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search clients..."
                  className="pl-9 w-full md:w-64"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <select
                className="px-3 py-2 border rounded-md text-sm"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="ALL">All Status</option>
                <option value="ACTIVE">Active</option>
                <option value="PROSPECTIVE">Prospective</option>
              </select>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add Client
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm text-muted-foreground border-b">
                    <th className="pb-4 font-medium">Client</th>
                    <th className="pb-4 font-medium">Contact</th>
                    <th className="pb-4 font-medium">Properties</th>
                    <th className="pb-4 font-medium">Portfolio Value</th>
                    <th className="pb-4 font-medium">Status</th>
                    <th className="pb-4 font-medium">Last Contact</th>
                    <th className="pb-4 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredClients.map((client) => (
                    <tr key={client.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="py-4">
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarFallback className="bg-primary text-white">
                              {client.name.split(' ').map((n: string) => n[0]).join('')}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{client.name}</span>
                        </div>
                      </td>
                      <td className="py-4">
                        <div className="space-y-1">
                          <p className="text-sm flex items-center gap-1">
                            <Mail className="w-3 h-3" /> {client.email}
                          </p>
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <Phone className="w-3 h-3" /> {client.phone}
                          </p>
                        </div>
                      </td>
                      <td className="py-4">
                        <div className="flex items-center gap-1">
                          <Home className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium">{client.properties}</span>
                        </div>
                      </td>
                      <td className="py-4 text-primary font-medium">
                        {client.totalValue > 0 ? formatCurrency(client.totalValue) : '-'}
                      </td>
                      <td className="py-4">
                        <Badge variant={client.status === 'ACTIVE' ? 'success' : 'outline'}>
                          {client.status}
                        </Badge>
                      </td>
                      <td className="py-4 text-muted-foreground">{client.lastContact}</td>
                      <td className="py-4">
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon">
                            <MessageSquare className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
