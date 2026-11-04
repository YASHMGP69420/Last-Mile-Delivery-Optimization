import React, { useState } from 'react';
import Papa from 'papaparse';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { DeliveriesApi } from '../../api/client';
import { CsvValidationSummary, CsvRowError } from '../../types';
import {
  UploadCloud,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  Download,
  Check,
  RefreshCw,
} from 'lucide-react';
import { clsx } from 'clsx';

interface CsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: () => void;
  batchId?: string | null;
}

const SAMPLE_CSV = `orderReference,customerName,customerPhone,customerEmail,street,city,zone,postalCode,weightKg,volumeM3,priority,timeWindowStart,timeWindowEnd,serviceDurationMinutes,latitude,longitude
#DEL-IMPORT-101,Bikash Mohanty,+91 94371 11222,bikash@example.in,Infocity Avenue Plot 12,Bhubaneswar,Patia (Z-1),751024,12.5,0.04,Urgent,09:00,11:00,10,20.354,85.817
#DEL-IMPORT-102,Smruti Mishra,+91 94372 22333,smruti@example.in,Janpath Road Block 3,Bhubaneswar,Saheed Nagar (Z-3),751007,8.2,0.02,Standard,11:00,13:00,10,20.288,85.852
#DEL-IMPORT-103,Ranjan Senapati,+91 94373 33444,ranjan@example.in,Nayapalli VIP Road,Bhubaneswar,Jaydev Vihar (Z-2),751013,15.0,0.05,Cold Chain,14:00,16:00,15,20.301,85.823`;

export const CsvImportModal: React.FC<CsvImportModalProps> = ({
  isOpen,
  onClose,
  onImportSuccess,
  batchId,
}) => {
  const [csvText, setCsvText] = useState<string>('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [validationSummary, setValidationSummary] = useState<CsvValidationSummary | null>(null);
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [isCommitting, setIsCommitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setCsvText(content);
      runClientDryRun(content);
    };
    reader.readAsText(file);
  };

  const handleLoadSample = () => {
    setFileName('sample_bhubaneswar_manifest.csv');
    setCsvText(SAMPLE_CSV);
    runClientDryRun(SAMPLE_CSV);
  };

  const runClientDryRun = async (rawCsv: string) => {
    if (!rawCsv.trim()) {
      setValidationSummary(null);
      return;
    }
    setIsValidating(true);
    setError(null);
    try {
      const res = await DeliveriesApi.importCsv(rawCsv, { dryRun: true, batchId });
      setValidationSummary(res.data);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'CSV dry-run validation failed');
      setValidationSummary(null);
    } finally {
      setIsValidating(false);
    }
  };

  const handleCommit = async () => {
    if (!csvText.trim()) return;
    setIsCommitting(true);
    setError(null);
    try {
      await DeliveriesApi.importCsv(csvText, { dryRun: false, batchId });
      onImportSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to import deliveries');
    } finally {
      setIsCommitting(false);
    }
  };

  const downloadErrorCsv = () => {
    if (!validationSummary || validationSummary.errors.length === 0) return;
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      'Row,Field,Error\n' +
      validationSummary.errors.map((e) => `${e.row},"${e.field}","${e.message}"`).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `manifest_errors_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Import Consignments via CSV"
      subtitle="PapaParse drag-and-drop batch ingestion with dry-run schema validation"
      maxWidth="2xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <Button variant="ghost" onClick={handleLoadSample} size="sm">
            Load Sample Manifest
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={onClose} disabled={isCommitting}>
              Cancel
            </Button>
            <Button
              variant="secondary"
              onClick={handleCommit}
              isLoading={isCommitting}
              disabled={!validationSummary || validationSummary.errorCount > 0 || validationSummary.validCount === 0}
              leftIcon={<Check className="w-4 h-4" />}
            >
              Commit Ingestion ({validationSummary?.validCount || 0} rows)
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-5 text-sm">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-xs font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Drag & Drop Upload Target */}
        <div className="border-2 border-dashed border-outline-variant hover:border-secondary rounded-lg p-6 text-center transition-colors bg-surface-low/40">
          <input
            type="file"
            id="csvFileInput"
            accept=".csv,text/csv"
            onChange={handleFileUpload}
            className="hidden"
          />
          <label htmlFor="csvFileInput" className="cursor-pointer block space-y-2">
            <UploadCloud className="w-10 h-10 text-secondary mx-auto" />
            <div className="text-xs font-semibold text-on-surface">
              {fileName ? (
                <span className="text-secondary font-mono">{fileName}</span>
              ) : (
                <>
                  Click to select CSV manifest or <span className="text-secondary underline">browse files</span>
                </>
              )}
            </div>
            <p className="text-[11px] text-on-surface-variant">
              Supports orderReference, customerName, street, zone, weightKg, time windows
            </p>
          </label>
        </div>

        {/* Dry-Run Validation Summary Cards */}
        {validationSummary && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-lg bg-surface-low border border-outline-variant">
                <span className="text-[11px] text-on-surface-variant font-medium block">
                  Total Parsed Rows
                </span>
                <span className="text-xl font-bold font-mono text-on-surface">
                  {validationSummary.totalRows}
                </span>
              </div>
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900">
                <div className="flex items-center gap-1.5 text-[11px] font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Valid Rows</span>
                </div>
                <span className="text-xl font-bold font-mono text-emerald-700">
                  {validationSummary.validCount}
                </span>
              </div>
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-900">
                <div className="flex items-center gap-1.5 text-[11px] font-medium">
                  <AlertCircle className="w-3.5 h-3.5 text-red-600" />
                  <span>Row Errors</span>
                </div>
                <span className="text-xl font-bold font-mono text-red-700">
                  {validationSummary.errorCount}
                </span>
              </div>
            </div>

            {/* Error Table if any errors */}
            {validationSummary.errorCount > 0 ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-red-700">
                    Row-Level Dry-Run Errors ({validationSummary.errors.length})
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="py-1 px-2 text-xs text-red-700 hover:bg-red-50"
                    leftIcon={<Download className="w-3 h-3" />}
                    onClick={downloadErrorCsv}
                  >
                    Download Error CSV
                  </Button>
                </div>
                <div className="max-h-40 overflow-y-auto border border-red-200 rounded-md bg-red-50/50">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-red-100/70 text-red-900 font-semibold sticky top-0">
                      <tr>
                        <th className="py-1.5 px-3 w-16">Row #</th>
                        <th className="py-1.5 px-3 w-32">Field</th>
                        <th className="py-1.5 px-3">Failure Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-red-200/60 font-mono text-[11px]">
                      {validationSummary.errors.map((err, i) => (
                        <tr key={i} className="hover:bg-red-100/40">
                          <td className="py-1.5 px-3 font-bold">{err.row}</td>
                          <td className="py-1.5 px-3 text-red-800">{err.field}</td>
                          <td className="py-1.5 px-3 text-red-950 font-sans">{err.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-md text-emerald-800 text-xs font-medium flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  All {validationSummary.validCount} rows passed schema validation and are ready to commit!
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
};
