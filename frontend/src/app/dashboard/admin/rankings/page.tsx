'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Crown,
  Trophy,
  Medal,
  Star,
  Calendar,
  Award,
  Users,
  Building,
  Wallet,
  Mail,
  BarChart3,
  Send,
  Check,
  Loader2,
  EyeOff,
  Eye,
  RefreshCw,
  Briefcase,
  ClipboardCheck,
  Clock,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { formatCurrency, getTierBgClass } from '@/lib/utils';
import { api, getImageUrl } from '@/lib/api';

interface LeaderboardRealtor {
  rank: number;
  realtorId: string;
  userId: string;
  name: string;
  avatar: string | null;
  email: string;
  tier: string;
  totalSales: number;
  totalValue: number;
  score: number;
  isRealtorOfMonth: boolean;
  isRealtorOfYear: boolean;
}

interface StaffLeaderboardEntry {
  rank: number;
  staffProfileId: string;
  userId: string;
  name: string;
  avatar: string | null;
  email: string;
  position: string;
  department: string;
  title: string;
  tasksCompleted: number;
  tasksOnTime: number;
  attendanceRate: number;
  avgReviewScore: number;
  score: number;
  isStaffOfMonth: boolean;
  isStaffOfYear: boolean;
}

interface ClientLeaderboardEntry {
  rank: number;
  clientProfileId: string;
  userId: string;
  name: string;
  avatar: string | null;
  email: string;
  propertiesOwned: number;
  purchaseCount: number;
  totalPurchaseValue: number;
  totalPropertyValue: number;
  score: number;
  isClientOfMonth: boolean;
  isClientOfYear: boolean;
}

const getRankIcon = (rank: number) => {
  if (rank === 1) return <Trophy className="w-6 h-6 text-yellow-500" />;
  if (rank === 2) return <Medal className="w-6 h-6 text-gray-400" />;
  if (rank === 3) return <Medal className="w-6 h-6 text-amber-600" />;
  return <span className="w-6 h-6 flex items-center justify-center font-bold text-muted-foreground">{rank}</span>;
};

type TimePeriod = 'MONTHLY' | 'QUARTERLY' | 'YEARLY' | 'ALL_TIME';

const PERIOD_LABELS: Record<TimePeriod, string> = {
  MONTHLY: 'This Month',
  QUARTERLY: 'This Quarter',
  YEARLY: 'This Year',
  ALL_TIME: 'All Time',
};

const AWARD_LABELS: Record<string, string> = {
  STAFF_OF_MONTH: 'Staff of the Month',
  REALTOR_OF_MONTH: 'Realtor of the Month',
  CLIENT_OF_MONTH: 'Client of the Month',
};

const AWARD_COLORS: Record<string, string> = {
  STAFF_OF_MONTH: 'from-blue-500 to-blue-600',
  REALTOR_OF_MONTH: 'from-[#2b1464] to-[#3b2190]',
  CLIENT_OF_MONTH: 'from-[#fca639] to-[#e8953a]',
};

const MONTH_NAMES = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function RankingsPage() {
  const [activeTab, setActiveTab] = useState<'realtors' | 'staff' | 'clients'>('realtors');
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('ALL_TIME');
  const [loading, setLoading] = useState(true);

  // Data from API
  const [realtors, setRealtors] = useState<LeaderboardRealtor[]>([]);
  const [staffMembers, setStaffMembers] = useState<StaffLeaderboardEntry[]>([]);
  const [clientRankings, setClientRankings] = useState<ClientLeaderboardEntry[]>([]);

  // Award publishing state
  const [awardCategory, setAwardCategory] = useState<'STAFF_OF_MONTH' | 'REALTOR_OF_MONTH' | 'CLIENT_OF_MONTH'>('REALTOR_OF_MONTH');
  const [awardReason, setAwardReason] = useState('');
  const [awardUserId, setAwardUserId] = useState('');
  const [awardUserName, setAwardUserName] = useState('');
  const [publishingAward, setPublishingAward] = useState(false);
  const [awardSuccess, setAwardSuccess] = useState('');
  const [awardError, setAwardError] = useState('');
  const [currentMonthAwards, setCurrentMonthAwards] = useState<any[]>([]);
  const [showAwardDialog, setShowAwardDialog] = useState(false);
  const [unpublishingId, setUnpublishingId] = useState<string | null>(null);

  // Staff search for STAFF_OF_MONTH
  const [staffList, setStaffList] = useState<any[]>([]);

  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  const fetchRealtorLeaderboard = useCallback(async () => {
    try {
      setLoading(true);
      const res: any = await api.get(`/rankings/leaderboard?period=${timePeriod}&limit=20`);
      const data = Array.isArray(res) ? res : (res?.data || []);
      setRealtors(data);
    } catch (err) {
      console.error('Failed to fetch leaderboard:', err);
      setRealtors([]);
    } finally {
      setLoading(false);
    }
  }, [timePeriod]);

  const handleRefresh = () => {
    fetchRealtorLeaderboard();
    fetchStaffLeaderboard();
    fetchClientLeaderboard();
    fetchCurrentMonthAwards();
  };

  const fetchStaffLeaderboard = useCallback(async () => {
    try {
      const res: any = await api.get(`/rankings/staff/leaderboard?period=${timePeriod}&limit=20`);
      const data = Array.isArray(res) ? res : (res?.data || []);
      setStaffMembers(data);
    } catch (err) {
      console.error('Failed to fetch staff leaderboard:', err);
      setStaffMembers([]);
    }
  }, [timePeriod]);

  const fetchClientLeaderboard = useCallback(async () => {
    try {
      const res: any = await api.get(`/rankings/clients/leaderboard?period=${timePeriod}&limit=20`);
      const data = Array.isArray(res) ? res : (res?.data || []);
      setClientRankings(data);
    } catch (err) {
      console.error('Failed to fetch client leaderboard:', err);
      setClientRankings([]);
    }
  }, [timePeriod]);

  const fetchStaff = useCallback(async () => {
    try {
      const res: any = await api.get('/staff?limit=50');
      const raw = res?.data?.data || res?.data || [];
      setStaffList(Array.isArray(raw) ? raw : []);
    } catch {
      setStaffList([]);
    }
  }, []);

  const fetchCurrentMonthAwards = useCallback(async () => {
    try {
      const res: any = await api.get('/awards/current-month');
      setCurrentMonthAwards(res?.data || res || []);
    } catch {
      setCurrentMonthAwards([]);
    }
  }, []);

  useEffect(() => {
    fetchRealtorLeaderboard();
    fetchStaffLeaderboard();
    fetchClientLeaderboard();
  }, [fetchRealtorLeaderboard, fetchStaffLeaderboard, fetchClientLeaderboard]);

  useEffect(() => {
    fetchCurrentMonthAwards();
    fetchStaff();
  }, [fetchCurrentMonthAwards, fetchStaff]);

  const handlePublishAward = async () => {
    if (!awardUserId || !awardReason) {
      setAwardError('Please select a user and provide a reason.');
      return;
    }
    setPublishingAward(true);
    setAwardError('');
    try {
      await api.post('/awards', {
        type: awardCategory,
        userId: awardUserId,
        month: currentMonth,
        year: currentYear,
        reason: awardReason,
        publishImmediately: true,
      });
      setAwardSuccess(`${AWARD_LABELS[awardCategory]} published successfully!`);
      setAwardReason('');
      setAwardUserId('');
      setAwardUserName('');
      setShowAwardDialog(false);
      await fetchCurrentMonthAwards();
      setTimeout(() => setAwardSuccess(''), 3000);
    } catch (err: any) {
      setAwardError(err?.message || 'Failed to publish award.');
    } finally {
      setPublishingAward(false);
    }
  };

  const handleUnpublishAward = async (awardId: string) => {
    setUnpublishingId(awardId);
    try {
      await api.patch(`/awards/${awardId}/unpublish`);
      await fetchCurrentMonthAwards();
    } catch (err: any) {
      setAwardError(err?.message || 'Failed to unpublish award.');
    } finally {
      setUnpublishingId(null);
    }
  };

  const handleRepublishAward = async (awardId: string) => {
    setUnpublishingId(awardId);
    try {
      await api.patch(`/awards/${awardId}/publish`);
      await fetchCurrentMonthAwards();
    } catch (err: any) {
      setAwardError(err?.message || 'Failed to republish award.');
    } finally {
      setUnpublishingId(null);
    }
  };

  const topRealtor = realtors[0];
  const topStaff = staffMembers[0];
  const topClient = clientRankings[0];

  return (
    <div className="space-y-6">
      {/* Tab Switcher */}
      <div className="flex flex-col sm:flex-row flex-wrap gap-2 justify-between items-start sm:items-center">
        <div className="flex gap-2">
          <Button
            variant={activeTab === 'realtors' ? 'default' : 'outline'}
            onClick={() => setActiveTab('realtors')}
            className="flex items-center gap-2"
          >
            <Award className="w-4 h-4" />
            Realtor Rankings
          </Button>
          <Button
            variant={activeTab === 'staff' ? 'default' : 'outline'}
            onClick={() => setActiveTab('staff')}
            className="flex items-center gap-2"
          >
            <Briefcase className="w-4 h-4" />
            Staff Rankings
          </Button>
          <Button
            variant={activeTab === 'clients' ? 'default' : 'outline'}
            onClick={() => setActiveTab('clients')}
            className="flex items-center gap-2"
          >
            <Users className="w-4 h-4" />
            Client Rankings
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Time Period Filter */}
        <div className="flex gap-2">
          {(['MONTHLY', 'QUARTERLY', 'YEARLY', 'ALL_TIME'] as TimePeriod[]).map((p) => (
            <Button
              key={p}
              variant={timePeriod === p ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTimePeriod(p)}
            >
              {p === 'MONTHLY' && <Calendar className="w-4 h-4 mr-2" />}
              {PERIOD_LABELS[p]}
            </Button>
          ))}
        </div>
      </div>

      {/* Award Publishing Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
      >
        <Card className="shadow-sm border-amber-200 bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-500" />
              Monthly Awards - {MONTH_NAMES[currentMonth]} {currentYear}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {awardSuccess && (
              <div className="mb-4 p-3 rounded-lg bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 flex items-center gap-2">
                <Check className="w-4 h-4" />
                {awardSuccess}
              </div>
            )}

            {awardError && !showAwardDialog && (
              <div className="mb-4 p-3 rounded-lg bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                {awardError}
              </div>
            )}

            {/* Current Month Awards (Published + Unpublished) */}
            {currentMonthAwards.length > 0 && (
              <div className="grid gap-3 md:grid-cols-3 mb-4">
                {currentMonthAwards.map((award: any) => (
                  <div
                    key={award.id}
                    className={`rounded-xl bg-gradient-to-br ${
                      award.isPublished
                        ? (AWARD_COLORS[award.type] || 'from-gray-500 to-gray-600')
                        : 'from-gray-400 to-gray-500'
                    } p-4 text-white ${!award.isPublished ? 'opacity-75' : ''}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Crown className="w-4 h-4 text-yellow-300" />
                        <span className="text-xs font-medium opacity-90">{AWARD_LABELS[award.type]}</span>
                      </div>
                      {award.isPublished ? (
                        <button
                          onClick={() => handleUnpublishAward(award.id)}
                          disabled={unpublishingId === award.id}
                          className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 transition-colors disabled:opacity-50"
                          title="Unpublish award"
                        >
                          {unpublishingId === award.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <EyeOff className="w-3.5 h-3.5" />
                          )}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleRepublishAward(award.id)}
                          disabled={unpublishingId === award.id}
                          className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 transition-colors disabled:opacity-50"
                          title="Republish award"
                        >
                          {unpublishingId === award.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Eye className="w-3.5 h-3.5" />
                          )}
                        </button>
                      )}
                    </div>
                    <p className="font-bold">
                      {award.user?.firstName} {award.user?.lastName}
                    </p>
                    <p className="text-xs opacity-80 mt-1">{award.reason}</p>
                    <Badge className={`text-xs mt-2 ${award.isPublished ? 'bg-white/20 text-white' : 'bg-red-500/30 text-white'}`}>
                      {award.isPublished ? 'Published' : 'Unpublished'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}

            {/* Publish New Award Buttons */}
            <div className="flex flex-wrap gap-2">
              {(['STAFF_OF_MONTH', 'REALTOR_OF_MONTH', 'CLIENT_OF_MONTH'] as const).map((type) => {
                const existingAward = Array.isArray(currentMonthAwards) && currentMonthAwards.find(
                  (a: any) => a.type === type
                );
                const alreadyPublished = existingAward?.isPublished;
                const existsButUnpublished = existingAward && !existingAward.isPublished;

                // Don't show "Publish" button if there's an unpublished award (use the Republish button on the card instead)
                if (existsButUnpublished) return null;

                return (
                  <Button
                    key={type}
                    variant={alreadyPublished ? 'outline' : 'default'}
                    size="sm"
                    disabled={alreadyPublished}
                    onClick={() => {
                      setAwardCategory(type);
                      setShowAwardDialog(true);
                      setAwardError('');
                      setAwardUserId('');
                      setAwardUserName('');
                    }}
                    className={alreadyPublished ? 'opacity-60' : 'bg-amber-600 hover:bg-amber-700 text-white'}
                  >
                    {alreadyPublished ? (
                      <><Check className="w-4 h-4 mr-1" /> {AWARD_LABELS[type]}</>
                    ) : (
                      <><Send className="w-4 h-4 mr-1" /> Publish {AWARD_LABELS[type]}</>
                    )}
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Award Publishing Dialog */}
      <Dialog open={showAwardDialog} onOpenChange={setShowAwardDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-500" />
              Publish {AWARD_LABELS[awardCategory]}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-sm text-muted-foreground">
              Select the winner for {MONTH_NAMES[currentMonth]} {currentYear}. They will see a celebration on their dashboard.
            </p>

            {/* Winner Selection */}
            <div>
              <label className="text-sm font-medium mb-2 block">Select Winner</label>
              {awardCategory === 'REALTOR_OF_MONTH' ? (
                <div className="max-h-48 overflow-y-auto space-y-1 border rounded-lg p-2">
                  {realtors.length === 0 && (
                    <p className="text-sm text-muted-foreground p-2">No realtors found. Make sure there are completed sales.</p>
                  )}
                  {realtors.slice(0, 10).map((r) => (
                    <button
                      key={r.userId}
                      onClick={() => {
                        setAwardUserName(r.name);
                        setAwardUserId(r.userId);
                      }}
                      className={`w-full flex items-center gap-3 p-2 rounded-lg text-left transition-colors ${
                        awardUserId === r.userId
                          ? 'bg-primary/10 border border-primary'
                          : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                      }`}
                    >
                      <div className="w-6 text-center text-sm font-bold text-muted-foreground">#{r.rank}</div>
                      <Avatar className="w-8 h-8">
                        {r.avatar && <AvatarImage src={getImageUrl(r.avatar)} alt={r.name} />}
                        <AvatarFallback className="bg-primary text-white text-xs">
                          {r.name.split(' ').map((n: string) => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{r.name}</p>
                        <p className="text-xs text-muted-foreground">{r.totalSales} sales - {formatCurrency(r.totalValue)}</p>
                      </div>
                      {awardUserId === r.userId && <Check className="w-4 h-4 text-primary" />}
                    </button>
                  ))}
                </div>
              ) : awardCategory === 'CLIENT_OF_MONTH' ? (
                <div className="max-h-48 overflow-y-auto space-y-1 border rounded-lg p-2">
                  {clientRankings.length === 0 && (
                    <p className="text-sm text-muted-foreground p-2">No clients found. Make sure there are purchases or properties.</p>
                  )}
                  {clientRankings.slice(0, 10).map((c) => (
                    <button
                      key={c.userId}
                      onClick={() => {
                        setAwardUserName(c.name);
                        setAwardUserId(c.userId);
                      }}
                      className={`w-full flex items-center gap-3 p-2 rounded-lg text-left transition-colors ${
                        awardUserId === c.userId
                          ? 'bg-emerald-500/10 border border-emerald-500'
                          : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                      }`}
                    >
                      <div className="w-6 text-center text-sm font-bold text-muted-foreground">#{c.rank}</div>
                      <Avatar className="w-8 h-8">
                        {c.avatar && <AvatarImage src={getImageUrl(c.avatar)} alt={c.name} />}
                        <AvatarFallback className="bg-emerald-600 text-white text-xs">
                          {c.name.split(' ').map((n: string) => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{c.name}</p>
                        <p className="text-xs text-muted-foreground">{c.propertiesOwned} properties - {c.purchaseCount} purchases</p>
                      </div>
                      {awardUserId === c.userId && <Check className="w-4 h-4 text-emerald-500" />}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="max-h-48 overflow-y-auto space-y-1 border rounded-lg p-2">
                  {staffList.length === 0 && (
                    <div className="p-2">
                      <p className="text-sm text-muted-foreground mb-2">No staff found. Enter user ID manually:</p>
                      <input
                        type="text"
                        placeholder="Staff user ID"
                        value={awardUserId}
                        onChange={(e) => setAwardUserId(e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                  )}
                  {staffList.map((s: any) => {
                    const staffUserId = s.user?.id || s.userId || s.id;
                    const staffName = `${s.user?.firstName || s.firstName || ''} ${s.user?.lastName || s.lastName || ''}`.trim();
                    return (
                      <button
                        key={staffUserId}
                        onClick={() => {
                          setAwardUserName(staffName);
                          setAwardUserId(staffUserId);
                        }}
                        className={`w-full flex items-center gap-3 p-2 rounded-lg text-left transition-colors ${
                          awardUserId === staffUserId
                            ? 'bg-blue-500/10 border border-blue-500'
                            : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                        }`}
                      >
                        <Avatar className="w-8 h-8">
                          <AvatarFallback className="bg-blue-600 text-white text-xs">
                            {staffName.split(' ').map((n: string) => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{staffName}</p>
                          <p className="text-xs text-muted-foreground">{s.user?.email || s.email || ''}</p>
                        </div>
                        {awardUserId === staffUserId && <Check className="w-4 h-4 text-blue-500" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Reason */}
            <div>
              <label className="text-sm font-medium mb-2 block">Achievement / Reason</label>
              <Textarea
                placeholder="e.g., Closed 12 deals worth over ₦125M this month..."
                value={awardReason}
                onChange={(e) => setAwardReason(e.target.value)}
                rows={3}
              />
            </div>

            {awardError && (
              <p className="text-sm text-red-600">{awardError}</p>
            )}

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowAwardDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={handlePublishAward}
                disabled={publishingAward || !awardUserId || !awardReason}
                className="bg-amber-600 hover:bg-amber-700 text-white"
              >
                {publishingAward ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Publishing...</>
                ) : (
                  <><Send className="w-4 h-4 mr-2" /> Publish Award</>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Realtor Featured Cards */}
      {activeTab === 'realtors' && topRealtor && (
        <div className="grid gap-6 md:grid-cols-2">
          <motion.div
            key={`realtor-${timePeriod}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="bg-gradient-to-br from-yellow-500 to-orange-500 text-white">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="w-5 h-5" />
                  {timePeriod === 'MONTHLY' ? 'Realtor of the Month' :
                   timePeriod === 'QUARTERLY' ? 'Realtor of the Quarter' :
                   timePeriod === 'YEARLY' ? 'Realtor of the Year' : 'Top Realtor'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <Avatar className="w-16 h-16 border-4 border-white/30">
                    {topRealtor.avatar && <AvatarImage src={getImageUrl(topRealtor.avatar)} alt={topRealtor.name} />}
                    <AvatarFallback className="bg-white/20 text-white text-xl">
                      {topRealtor.name.split(' ').map((n: string) => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="text-xl font-bold">{topRealtor.name}</h3>
                    <Badge className="bg-white/20 text-white">{topRealtor.tier}</Badge>
                    <p className="text-sm text-white/80 mt-1">{PERIOD_LABELS[timePeriod]}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-6">
                  <div>
                    <p className="text-2xl font-bold">{topRealtor.totalSales}</p>
                    <p className="text-sm text-white/80">Sales</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{formatCurrency(topRealtor.totalValue)}</p>
                    <p className="text-sm text-white/80">Total Value</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="bg-gradient-to-br from-purple-600 to-indigo-600 text-white">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  {PERIOD_LABELS[timePeriod]} Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-white/10 rounded-lg">
                    <p className="text-3xl font-bold">{realtors.reduce((acc, r) => acc + r.totalSales, 0)}</p>
                    <p className="text-sm text-white/80">Total Sales</p>
                  </div>
                  <div className="p-4 bg-white/10 rounded-lg">
                    <p className="text-3xl font-bold">{realtors.length}</p>
                    <p className="text-sm text-white/80">Active Realtors</p>
                  </div>
                  <div className="p-4 bg-white/10 rounded-lg col-span-2">
                    <p className="text-2xl font-bold">{formatCurrency(realtors.reduce((acc, r) => acc + r.totalValue, 0))}</p>
                    <p className="text-sm text-white/80">Total Value</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      )}

      {/* Staff Featured Cards */}
      {activeTab === 'staff' && topStaff && (
        <div className="grid gap-6 md:grid-cols-2">
          <motion.div
            key={`staff-${timePeriod}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="w-5 h-5" />
                  {timePeriod === 'MONTHLY' ? 'Staff of the Month' :
                   timePeriod === 'QUARTERLY' ? 'Staff of the Quarter' :
                   timePeriod === 'YEARLY' ? 'Staff of the Year' : 'Top Staff'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <Avatar className="w-16 h-16 border-4 border-white/30">
                    {topStaff.avatar && <AvatarImage src={getImageUrl(topStaff.avatar)} alt={topStaff.name} />}
                    <AvatarFallback className="bg-white/20 text-white text-xl">
                      {topStaff.name.split(' ').map((n: string) => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="text-xl font-bold">{topStaff.name}</h3>
                    <Badge className="bg-white/20 text-white">{topStaff.position || topStaff.title || 'Staff'}</Badge>
                    {topStaff.department && (
                      <p className="text-sm text-white/80 mt-1">{topStaff.department}</p>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4 mt-6">
                  <div>
                    <p className="text-2xl font-bold">{topStaff.tasksCompleted}</p>
                    <p className="text-sm text-white/80">Tasks Done</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{topStaff.attendanceRate.toFixed(0)}%</p>
                    <p className="text-sm text-white/80">Attendance</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{topStaff.avgReviewScore.toFixed(1)}</p>
                    <p className="text-sm text-white/80">Review Score</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="bg-gradient-to-br from-indigo-600 to-violet-600 text-white">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  {PERIOD_LABELS[timePeriod]} Staff Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-white/10 rounded-lg">
                    <p className="text-3xl font-bold">{staffMembers.reduce((acc, s) => acc + s.tasksCompleted, 0)}</p>
                    <p className="text-sm text-white/80">Total Tasks Completed</p>
                  </div>
                  <div className="p-4 bg-white/10 rounded-lg">
                    <p className="text-3xl font-bold">{staffMembers.length}</p>
                    <p className="text-sm text-white/80">Active Staff</p>
                  </div>
                  <div className="p-4 bg-white/10 rounded-lg">
                    <p className="text-2xl font-bold">
                      {staffMembers.length > 0
                        ? (staffMembers.reduce((acc, s) => acc + s.attendanceRate, 0) / staffMembers.length).toFixed(0)
                        : 0}%
                    </p>
                    <p className="text-sm text-white/80">Avg Attendance</p>
                  </div>
                  <div className="p-4 bg-white/10 rounded-lg">
                    <p className="text-2xl font-bold">
                      {staffMembers.length > 0
                        ? (staffMembers.reduce((acc, s) => acc + s.avgReviewScore, 0) / staffMembers.length).toFixed(1)
                        : 0}
                    </p>
                    <p className="text-sm text-white/80">Avg Review Score</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      )}

      {/* Client Featured Cards */}
      {activeTab === 'clients' && topClient && (
        <div className="grid gap-6 md:grid-cols-2">
          <motion.div
            key={`client-${timePeriod}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="bg-gradient-to-br from-emerald-500 to-teal-500 text-white">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="w-5 h-5" />
                  {timePeriod === 'MONTHLY' ? 'Client of the Month' :
                   timePeriod === 'QUARTERLY' ? 'Client of the Quarter' :
                   timePeriod === 'YEARLY' ? 'Client of the Year' : 'Top Client'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <Avatar className="w-16 h-16 border-4 border-white/30">
                    {topClient.avatar && <AvatarImage src={getImageUrl(topClient.avatar)} alt={topClient.name} />}
                    <AvatarFallback className="bg-white/20 text-white text-xl">
                      {topClient.name.split(' ').map((n: string) => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="text-xl font-bold">{topClient.name}</h3>
                    <Badge className="bg-white/20 text-white">
                      {topClient.isClientOfMonth ? 'Client of the Month' : 'VIP Client'}
                    </Badge>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-6">
                  <div>
                    <p className="text-2xl font-bold">{topClient.propertiesOwned}</p>
                    <p className="text-sm text-white/80">Properties Owned</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{topClient.purchaseCount}</p>
                    <p className="text-sm text-white/80">Purchases</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="bg-gradient-to-br from-blue-600 to-cyan-600 text-white">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  {PERIOD_LABELS[timePeriod]} Client Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-white/10 rounded-lg">
                    <p className="text-3xl font-bold">{clientRankings.reduce((acc, c) => acc + c.purchaseCount, 0)}</p>
                    <p className="text-sm text-white/80">Total Purchases</p>
                  </div>
                  <div className="p-4 bg-white/10 rounded-lg">
                    <p className="text-3xl font-bold">{clientRankings.length}</p>
                    <p className="text-sm text-white/80">Ranked Clients</p>
                  </div>
                  <div className="p-4 bg-white/10 rounded-lg col-span-2">
                    <p className="text-2xl font-bold">{clientRankings.reduce((acc, c) => acc + c.propertiesOwned, 0)}</p>
                    <p className="text-sm text-white/80">Total Properties Owned</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      )}

      {/* Realtor Leaderboard */}
      {activeTab === 'realtors' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-primary" />
                Top Realtors Leaderboard - {PERIOD_LABELS[timePeriod]}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : realtors.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  No ranking data available for this period. Rankings are generated from completed sales.
                </div>
              ) : (
                <div className="space-y-3">
                  {realtors.map((realtor, index) => (
                    <motion.div
                      key={realtor.realtorId}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 + index * 0.05 }}
                      className={`flex items-center gap-4 p-4 rounded-lg transition-all hover:shadow-md hover:scale-[1.01] ${
                        realtor.rank <= 3
                          ? 'bg-gradient-to-r from-primary/10 to-transparent hover:from-primary/20'
                          : 'bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800'
                      }`}
                    >
                      <div className="w-10 flex justify-center">
                        {getRankIcon(realtor.rank)}
                      </div>
                      <Avatar>
                        {realtor.avatar && <AvatarImage src={getImageUrl(realtor.avatar)} alt={realtor.name} />}
                        <AvatarFallback className="bg-primary text-white">
                          {realtor.name.split(' ').map((n: string) => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold">{realtor.name}</p>
                          <Badge className={getTierBgClass(realtor.tier)}>{realtor.tier}</Badge>
                          {realtor.isRealtorOfMonth && <Badge className="bg-yellow-500 text-white text-xs">ROTM</Badge>}
                        </div>
                        <p className="text-sm text-muted-foreground">{realtor.totalSales} sales</p>
                      </div>
                      <div className="text-right hidden md:block">
                        <p className="font-semibold">{formatCurrency(realtor.totalValue)}</p>
                        <p className="text-sm text-muted-foreground">Total Value</p>
                      </div>
                      <div className="text-right hidden md:block">
                        <div className="flex items-center gap-1 justify-end">
                          <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                          <p className="text-xs text-muted-foreground truncate max-w-[140px]">{realtor.email}</p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Staff Leaderboard */}
      {activeTab === 'staff' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-blue-600" />
                Staff Leaderboard - {PERIOD_LABELS[timePeriod]}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : staffMembers.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  No staff ranking data available for this period. Rankings are generated from tasks, attendance, and reviews.
                </div>
              ) : (
                <div className="space-y-3">
                  {staffMembers.map((staff, index) => (
                    <motion.div
                      key={staff.staffProfileId}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 + index * 0.05 }}
                      className={`flex items-center gap-4 p-4 rounded-lg transition-all hover:shadow-md hover:scale-[1.01] ${
                        staff.rank <= 3
                          ? 'bg-gradient-to-r from-blue-500/10 to-transparent hover:from-blue-500/20'
                          : 'bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800'
                      }`}
                    >
                      <div className="w-10 flex justify-center">
                        {getRankIcon(staff.rank)}
                      </div>
                      <Avatar>
                        {staff.avatar && <AvatarImage src={getImageUrl(staff.avatar)} alt={staff.name} />}
                        <AvatarFallback className="bg-blue-600 text-white">
                          {staff.name.split(' ').map((n: string) => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold">{staff.name}</p>
                          {staff.department && (
                            <Badge variant="secondary" className="text-xs">{staff.department}</Badge>
                          )}
                          {staff.isStaffOfMonth && <Badge className="bg-blue-500 text-white text-xs">SOTM</Badge>}
                        </div>
                        <p className="text-sm text-muted-foreground">{staff.position || staff.title || 'Staff'}</p>
                      </div>
                      <div className="text-right hidden md:flex items-center gap-6">
                        <div className="flex items-center gap-1.5">
                          <ClipboardCheck className="w-4 h-4 text-muted-foreground" />
                          <div>
                            <p className="font-semibold text-sm">{staff.tasksCompleted}</p>
                            <p className="text-xs text-muted-foreground">Tasks</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-4 h-4 text-muted-foreground" />
                          <div>
                            <p className="font-semibold text-sm">{staff.attendanceRate.toFixed(0)}%</p>
                            <p className="text-xs text-muted-foreground">Attendance</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Star className="w-4 h-4 text-muted-foreground" />
                          <div>
                            <p className="font-semibold text-sm">{staff.avgReviewScore.toFixed(1)}</p>
                            <p className="text-xs text-muted-foreground">Review</p>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Client Leaderboard */}
      {activeTab === 'clients' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                Client Leaderboard - {PERIOD_LABELS[timePeriod]}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : clientRankings.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  No client ranking data available for this period. Rankings are generated from purchases and property ownership.
                </div>
              ) : (
                <div className="space-y-3">
                  {clientRankings.map((client, index) => (
                    <motion.div
                      key={client.clientProfileId}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 + index * 0.05 }}
                      className={`flex items-center gap-4 p-4 rounded-lg transition-all hover:shadow-md hover:scale-[1.01] ${
                        client.rank <= 3
                          ? 'bg-gradient-to-r from-emerald-500/10 to-transparent hover:from-emerald-500/20'
                          : 'bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800'
                      }`}
                    >
                      <div className="w-10 flex justify-center">
                        {getRankIcon(client.rank)}
                      </div>
                      <Avatar>
                        {client.avatar && <AvatarImage src={getImageUrl(client.avatar)} alt={client.name} />}
                        <AvatarFallback className="bg-emerald-600 text-white">
                          {client.name.split(' ').map((n: string) => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold">{client.name}</p>
                          {client.isClientOfMonth && <Badge className="bg-emerald-600 text-white text-xs">COTM</Badge>}
                        </div>
                        <p className="text-sm text-muted-foreground">{client.email}</p>
                      </div>
                      <div className="text-right hidden md:block">
                        <div className="flex items-center gap-1 justify-end">
                          <Building className="w-4 h-4 text-muted-foreground" />
                          <p className="font-semibold">{client.propertiesOwned}</p>
                        </div>
                        <p className="text-sm text-muted-foreground">Properties</p>
                      </div>
                      <div className="text-right hidden md:block">
                        <div className="flex items-center gap-1 justify-end">
                          <Wallet className="w-4 h-4 text-emerald-600" />
                          <p className="font-semibold text-emerald-600">{client.purchaseCount}</p>
                        </div>
                        <p className="text-sm text-muted-foreground">Purchases</p>
                      </div>
                      <div className="text-right hidden lg:block">
                        <p className="font-semibold">{formatCurrency(client.totalPurchaseValue)}</p>
                        <p className="text-sm text-muted-foreground">Total Value</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
