import { useState, useRef } from "react";
import { UploadCloud, ScanLine, CheckCircle, XCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import apiClient from "../api/client";

export default function UploadZone({ onUploadSuccess }) {
  const [isDragging, setIsDragging] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [result, setResult] = useState(null);
  const [isSuccessFlash, setIsSuccessFlash] = useState(false);
  const fileInputRef = useRef(null);

  const handleFile = async (file) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setResult({ success: false, message: "Image is larger than 5MB." });
      setTimeout(() => setResult(null), 4000);
      return;
    }
    setIsScanning(true);
    setResult(null);
    
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await apiClient.post("/entries/upload-scan", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      
      // The backend returns the scan record even when the AI step fails
      const scan = res.data || {};
      if (scan.status === "failed") {
        setResult({ success: false, message: scan.error_message || "Gemini could not read this page." });
        return;
      }
      const numExtracted = scan.entries_extracted ?? 0;
      setIsSuccessFlash(true);
      setTimeout(() => setIsSuccessFlash(false), 400);
      setResult({
        success: numExtracted > 0,
        message: numExtracted > 0
          ? `${numExtracted} ${numExtracted === 1 ? "entry" : "entries"} extracted ✓`
          : "No entries found on this page.",
      });
      if (onUploadSuccess) onUploadSuccess();
    } catch (err) {
      const msg = err.response?.data?.detail || "Failed to process scan.";
      setResult({ success: false, message: msg });
    } finally {
      setIsScanning(false);
      setTimeout(() => setResult(null), 4000);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="glass-card"
    >
      <h3>Scan Bahi Page</h3>
      <p className="text-secondary" style={{ marginBottom: 20 }}>
        Upload a photo of your ledger and let Gemini extract the entries automatically.
      </p>
      
      <div 
        className={`upload-zone ${isDragging ? 'drag-active' : ''}`}
        style={{
          background: isSuccessFlash ? 'rgba(34,197,94,0.3)' : '',
          transition: 'background 400ms ease'
        }}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          const file = e.dataTransfer.files[0];
          handleFile(file);
        }}
        onClick={() => !isScanning && fileInputRef.current?.click()}
      >
        <AnimatePresence mode="wait">
          {isScanning ? (
            <motion.div
              key="scanning"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{
                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                background: 'rgba(0,0,0,0.6)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12,
                zIndex: 10, borderRadius: '12px'
              }}
            >
              <motion.div 
                style={{ position: 'absolute', left: 0, right: 0, height: '3px', background: 'var(--accent)', boxShadow: '0 0 15px var(--accent)' }}
                animate={{ top: ['2%', '96%'] }}
                transition={{ repeat: Infinity, duration: 1.4, ease: "linear" }}
              />
              <ScanLine size={48} color="var(--accent)" className="pulse" style={{ position: 'relative', zIndex: 11 }} />
              <div style={{ fontWeight: 600, color: 'var(--accent)', position: 'relative', zIndex: 11 }}>Gemini is reading your bahi...</div>
            </motion.div>
          ) : (
            <motion.div
              key="idle"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}
            >
              <UploadCloud size={48} color="var(--text-secondary)" />
              <div style={{ fontWeight: 600 }}>Click or drag a photo here</div>
              <div className="text-secondary" style={{ fontSize: 13 }}>Supports JPG, PNG, WebP (Max 5MB)</div>
            </motion.div>
          )}
        </AnimatePresence>
        
        <input 
          type="file" 
          ref={fileInputRef}
          style={{ display: 'none' }}
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => { handleFile(e.target.files[0]); e.target.value = ""; }}
        />
      </div>

      <AnimatePresence>
        {result && (
          <motion.div 
            initial={{ opacity: 0, y: 10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto', marginTop: 16 }}
            exit={{ opacity: 0, y: -10, height: 0, marginTop: 0 }}
            style={{
              overflow: 'hidden',
              padding: '0 12px',
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: result.success ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
              color: result.success ? 'var(--accent)' : 'var(--danger)'
            }}
          >
            <div style={{ padding: '12px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
              {result.success ? <CheckCircle size={18} /> : <XCircle size={18} />}
              <span style={{ fontSize: 14, fontWeight: 500 }}>{result.message}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
