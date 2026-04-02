import React, { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { FileArrowUp, FileXls, FilePdf, Check, X, CircleNotch } from '@phosphor-icons/react';
import { toast } from 'sonner';

const ImportData = () => {
  const { api, isManager } = useAuth();
  const [file, setFile] = useState(null);
  const [inventoryType, setInventoryType] = useState('bar');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      const validTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'application/pdf',
        'text/csv'
      ];
      const validExtensions = ['.xlsx', '.xls', '.pdf', '.csv'];
      
      const hasValidExtension = validExtensions.some(ext => 
        selectedFile.name.toLowerCase().endsWith(ext)
      );
      
      if (!hasValidExtension && !validTypes.includes(selectedFile.type)) {
        toast.error('Please select an Excel, CSV, or PDF file');
        return;
      }
      
      setFile(selectedFile);
      setResult(null);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error('Please select a file first');
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await api.post(
        `/import/inventory?inventory_type=${inventoryType}`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      setResult({
        success: true,
        message: response.data.message,
        count: response.data.count,
      });
      toast.success(response.data.message);
    } catch (error) {
      const errorMessage = error.response?.data?.detail || 'Upload failed';
      setResult({
        success: false,
        message: errorMessage,
      });
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setFile(null);
    setResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const getFileIcon = () => {
    if (!file) return <FileArrowUp className="w-12 h-12 text-[#5A5A70]" />;
    const ext = file.name.toLowerCase();
    if (ext.endsWith('.pdf')) return <FilePdf className="w-12 h-12 text-[#D62828]" />;
    return <FileXls className="w-12 h-12 text-[#10B981]" />;
  };

  if (!isManager) {
    return (
      <div className="pb-24 fade-in text-center py-12" data-testid="import-data">
        <FileArrowUp className="w-16 h-16 text-[#2B2B4A] mx-auto mb-4" />
        <p className="text-[#5A5A70]">
          Manager access required to import data
        </p>
      </div>
    );
  }

  return (
    <div className="pb-24 fade-in" data-testid="import-data">
      <div className="mb-6">
        <h1 className="text-2xl font-light tracking-tight text-[#F5F5F0] flex items-center gap-2">
          <FileArrowUp className="w-6 h-6 text-[#D4A017]" />
          Import Inventory
        </h1>
        <p className="text-sm text-[#8E8E9F]">Upload Excel, CSV, or PDF files</p>
      </div>

      {/* Inventory Type Selector */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setInventoryType('bar')}
          className={`flex-1 py-3 rounded-xl font-medium transition-all ${
            inventoryType === 'bar' 
              ? 'bg-[#D4A017] text-[#0A0A12]' 
              : 'bg-[#1A1A2E] text-[#8E8E9F] border border-[#2B2B4A]'
          }`}
          data-testid="type-bar"
        >
          Bar Inventory
        </button>
        <button
          onClick={() => setInventoryType('kitchen')}
          className={`flex-1 py-3 rounded-xl font-medium transition-all ${
            inventoryType === 'kitchen' 
              ? 'bg-[#D4A017] text-[#0A0A12]' 
              : 'bg-[#1A1A2E] text-[#8E8E9F] border border-[#2B2B4A]'
          }`}
          data-testid="type-kitchen"
        >
          Kitchen Inventory
        </button>
      </div>

      {/* Upload Area */}
      <div 
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
          file ? 'border-[#D4A017] bg-[#D4A017]/5' : 'border-[#2B2B4A] bg-[#1A1A2E]'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv,.pdf"
          onChange={handleFileSelect}
          className="hidden"
          id="file-input"
          data-testid="file-input"
        />
        
        <label 
          htmlFor="file-input"
          className="cursor-pointer flex flex-col items-center"
        >
          {getFileIcon()}
          
          {file ? (
            <div className="mt-4">
              <p className="text-[#F5F5F0] font-medium">{file.name}</p>
              <p className="text-sm text-[#8E8E9F] mt-1">
                {(file.size / 1024).toFixed(1)} KB
              </p>
            </div>
          ) : (
            <div className="mt-4">
              <p className="text-[#F5F5F0]">Tap to select file</p>
              <p className="text-sm text-[#5A5A70] mt-1">
                Excel (.xlsx, .xls), CSV, or PDF
              </p>
            </div>
          )}
        </label>
      </div>

      {/* Expected Format Info */}
      <div className="mt-4 p-4 bg-[#1A1A2E] border border-white/5 rounded-xl">
        <h4 className="text-xs uppercase tracking-wider text-[#5A5A70] font-semibold mb-2">
          Expected Columns
        </h4>
        <div className="text-sm text-[#8E8E9F] space-y-1">
          {inventoryType === 'bar' ? (
            <>
              <p>• <span className="text-[#F5F5F0]">name</span> (required)</p>
              <p>• category, subcategory, location, section</p>
              <p>• bottle_size_ml, cost_per_unit</p>
            </>
          ) : (
            <>
              <p>• <span className="text-[#F5F5F0]">name</span> (required)</p>
              <p>• unit, location, station, vendor</p>
              <p>• cost_per_unit, par_level</p>
            </>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 mt-6">
        {file && (
          <button
            onClick={handleClear}
            className="py-4 px-6 bg-[#1A1A2E] border border-[#2B2B4A] text-[#8E8E9F] 
                       rounded-xl active:bg-[#252540]"
            data-testid="clear-btn"
          >
            <X className="w-5 h-5" />
          </button>
        )}
        <button
          onClick={handleUpload}
          disabled={!file || loading}
          className="flex-1 py-4 bg-[#D4A017] text-[#0A0A12] rounded-xl font-medium
                     flex items-center justify-center gap-2 disabled:opacity-50
                     active:bg-[#E5B83A]"
          data-testid="upload-btn"
        >
          {loading ? (
            <>
              <CircleNotch className="w-5 h-5 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <FileArrowUp className="w-5 h-5" />
              Upload & Import
            </>
          )}
        </button>
      </div>

      {/* Result Display */}
      {result && (
        <div className={`mt-6 p-4 rounded-xl flex items-center gap-3 ${
          result.success 
            ? 'bg-[#10B981]/20 border border-[#10B981]/50' 
            : 'bg-[#D62828]/20 border border-[#D62828]/50'
        }`}>
          {result.success ? (
            <Check className="w-6 h-6 text-[#10B981]" weight="bold" />
          ) : (
            <X className="w-6 h-6 text-[#D62828]" weight="bold" />
          )}
          <div>
            <p className={result.success ? 'text-[#10B981]' : 'text-[#D62828]'}>
              {result.message}
            </p>
            {result.count && (
              <p className="text-sm text-[#8E8E9F] mt-1">
                {result.count} items imported
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ImportData;
