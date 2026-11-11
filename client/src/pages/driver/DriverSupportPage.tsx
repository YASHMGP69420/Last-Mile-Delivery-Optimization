import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DriverHudApi } from '../../api/client';
import { Toast } from '../../components/common/Toast';
import {
  AlertTriangle,
  Phone,
  ShieldAlert,
  Send,
  RotateCw,
  CheckCircle2,
  Clock,
  ArrowLeft,
  LifeBuoy,
} from 'lucide-react';
import { Button } from '../../components/common/Button';

export const DriverSupportPage: React.FC = () => {
  const navigate = useNavigate();
  const [incidents, setIncidents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitNotice, setSubmitNotice] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    category: 'ROUTE_OBSTRUCTION',
    severity: 'MEDIUM',
    description: '',
  });

  const fetchIncidents = async () => {
    setIsLoading(true);
    try {
      const res = await DriverHudApi.getIncidents();
      setIncidents(res.data.incidents || []);
    } catch (err) {
      console.error('Failed to load incidents:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchIncidents();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.description || formData.description.trim().length < 5) {
      setToastMsg('Please provide a detailed description (minimum 5 characters).');
      return;
    }

    setIsSubmitting(true);
    setSubmitNotice(null);
    try {
      const res = await DriverHudApi.reportIncident(formData);
      const reroute = res.data?.reoptimization;
      if (reroute?.triggered) {
        setSubmitNotice(
          `Incident logged & route ${reroute.routeCode || 'active route'} automatically re-optimized for heavy traffic across ${reroute.pendingStopsCount} remaining stop(s).`
        );
      } else {
        setSubmitNotice('Incident logged. Fleet Operations Center notified with priority alert.');
      }
      setFormData({ category: 'ROUTE_OBSTRUCTION', severity: 'MEDIUM', description: '' });
      fetchIncidents();
    } catch (err: any) {
      setToastMsg(err.response?.data?.error?.message || 'Failed to report incident');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto smooth-scroll overscroll-y-contain p-4 pb-24 space-y-4 select-none">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/driver')}
          aria-label="Back to Cockpit"
          className="text-xs font-semibold text-on-surface-variant hover:text-on-surface flex items-center gap-1"
        >
          <ArrowLeft className="w-4 h-4" /> Cockpit
        </button>
        <span className="font-mono text-xs font-bold text-amber-600 dark:text-amber-400">Ops Hotline</span>
      </div>

      <div>
        <h1 className="text-lg font-black text-on-surface flex items-center gap-2">
          <LifeBuoy className="w-5 h-5 text-red-500" />
          Field Support & Incident Reporting
        </h1>
        <p className="text-[11px] text-on-surface-variant">
          Emergency response contacts and operational obstruction escalations.
        </p>
      </div>

      {/* Offline Emergency Contacts Box */}
      <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 space-y-2">
        <div className="flex items-center gap-2 text-red-500 font-bold text-xs uppercase tracking-wider">
          <ShieldAlert className="w-4 h-4" />
          Immediate Emergency Contacts (Offline Accessible)
        </div>
        <p className="text-[11px] text-on-surface">
          In case of severe accident or physical hazard, dial immediately:
        </p>
        <div className="grid grid-cols-3 gap-2 pt-1">
          <a
            href="tel:112"
            className="p-2 rounded-xl bg-surface border border-red-500/30 text-center block text-xs font-bold text-red-500"
          >
            Police (112)
          </a>
          <a
            href="tel:108"
            className="p-2 rounded-xl bg-surface border border-red-500/30 text-center block text-xs font-bold text-red-500"
          >
            Ambulance (108)
          </a>
          <a
            href="tel:+916742580100"
            className="p-2 rounded-xl bg-surface border border-red-500/30 text-center block text-xs font-bold text-secondary"
          >
            Hub Dispatch
          </a>
        </div>
      </div>

      {submitNotice && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{submitNotice}</span>
        </div>
      )}

      {/* Incident Reporting Form */}
      <form onSubmit={handleSubmit} className="p-4 rounded-2xl bg-surface-lowest border border-outline-variant shadow-sm space-y-3 text-xs">
        <h2 className="font-bold text-on-surface uppercase tracking-wider">Report Operational Issue</h2>

        <div>
          <label htmlFor="incident-category-select" className="font-semibold text-on-surface block mb-1">Issue Category</label>
          <select
            id="incident-category-select"
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            className="w-full px-2.5 py-2 rounded-xl bg-surface border border-outline-variant text-on-surface focus:outline-none"
          >
            <option value="ROUTE_OBSTRUCTION">Route Obstruction (Road blocked / flooded)</option>
            <option value="VEHICLE_PROBLEM">Vehicle Breakdown / Puncture / Flat battery</option>
            <option value="DELIVERY_ISSUE">Consignment Issue / Missing parcel</option>
            <option value="CUSTOMER_UNAVAILABLE">Customer Conflict / Address unresolved</option>
            <option value="ACCIDENT_OR_SAFETY">Accident / Safety Incident</option>
            <option value="OTHER">Other Operational Disruption</option>
          </select>
        </div>

        <div>
          <label htmlFor="incident-severity-select" className="font-semibold text-on-surface block mb-1">Severity</label>
          <select
            id="incident-severity-select"
            value={formData.severity}
            onChange={(e) => setFormData({ ...formData, severity: e.target.value })}
            className="w-full px-2.5 py-2 rounded-xl bg-surface border border-outline-variant text-on-surface focus:outline-none font-mono"
          >
            <option value="LOW">LOW</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="HIGH">HIGH (Urgent Dispatch Response)</option>
            <option value="CRITICAL">CRITICAL (Immediate Safety Threat)</option>
          </select>
        </div>

        <div>
          <label htmlFor="incident-description-input" className="font-semibold text-on-surface block mb-1">Description & Location</label>
          <textarea
            id="incident-description-input"
            required
            aria-required="true"
            rows={3}
            placeholder="Describe the obstruction, landmark, and what assistance is needed..."
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full p-2.5 rounded-xl bg-surface border border-outline-variant text-on-surface focus:outline-none"
          />
        </div>

        <Button
          type="submit"
          variant="primary"
          isLoading={isSubmitting}
          className="w-full h-12 bg-red-600 hover:bg-red-500 active:scale-[0.99] text-white font-bold rounded-2xl"
        >
          <Send className="w-4 h-4 mr-1.5" />
          Transmit Incident to Dispatch
        </Button>
      </form>

      {/* Incident History */}
      <div className="space-y-2">
        <h2 className="text-xs font-bold text-on-surface uppercase tracking-wider">Reported Incident History ({incidents.length})</h2>
        {incidents.length === 0 ? (
          <p className="text-xs text-on-surface-variant p-4 bg-surface-lowest rounded-xl border border-outline-variant text-center">
            No active or past incidents logged today.
          </p>
        ) : (
          incidents.map((inc) => (
            <div key={inc._id || inc.id} className="p-3 rounded-xl bg-surface-lowest border border-outline-variant text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-on-surface font-mono">{inc.category}</span>
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded font-mono uppercase bg-amber-500/10 text-amber-700 dark:text-amber-300">
                  {inc.status}
                </span>
              </div>
              <p className="text-on-surface-variant text-[11px]">{inc.description}</p>
              <span className="text-[10px] text-on-surface-muted font-mono block">
                {new Date(inc.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
              </span>
            </div>
          ))
        )}
      </div>
      {toastMsg && <Toast message={toastMsg} onClose={() => setToastMsg(null)} />}
    </div>
  );
};
