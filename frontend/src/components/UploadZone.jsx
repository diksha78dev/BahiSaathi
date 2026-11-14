/**
 * Upload a photo of a bahi page. Props: onUpload(file) → resolves to the scan record.
 * The AI's draft is then reviewed in <ScanReview> (the Dashboard shows it).
 * File type and size limits are enforced by the backend; its message is shown here.
 */
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle, ScanLine, UploadCloud, XCircle } from "lucide-react";
import { useRef, useState } from "react";
import { getErrorMessage } from "../api/client";

const RESULT_VISIBLE_MS = 6000;

/** Turn the scan record from the backend into a message for the user */
function describeScan(scan) {
  if (scan.status === "failed") {
    return { success: false, message: scan.error_message || "The AI couldn't read this page." };
  }
  const count = scan.extracted_entries.length;
  if (count === 0) return { success: false, message: "No entries found on this page." };
  return { success: true, message: `${count} ${count === 1 ? "line" : "lines"} found — review them before saving.` };
}

export default function UploadZone({ onUpload }) {
  const [isDragging, setIsDragging] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [result, setResult] = useState(null);
  const fileInputRef = useRef(null);

  const handleFile = async (file) => {
    if (!file || isScanning) return;
    setIsScanning(true);
    setResult(null);
    try {
      setResult(describeScan(await onUpload(file)));
    } catch (err) {
      setResult({ success: false, message: getErrorMessage(err, "Upload failed.") });
    } finally {
      setIsScanning(false);
      setTimeout(() => setResult(null), RESULT_VISIBLE_MS);
    }
  };

  return (
    <div className="glass-card">
      <h3>Scan Bahi Page</h3>
      <p className="text-secondary" style={{ marginBottom: 20 }}>
        Upload a photo of your ledger. Gemini reads it, and you check the lines before they're saved.
      </p>

      <div
        className={`upload-zone ${isDragging ? "drag-active" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFile(e.dataTransfer.files[0]); }}
        onClick={() => !isScanning && fileInputRef.current?.click()}
      >
        <AnimatePresence mode="wait">
          {isScanning ? (
            <motion.div key="scanning" className="scan-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <motion.div className="scan-line" animate={{ top: ["2%", "96%"] }} transition={{ repeat: Infinity, duration: 1.4, ease: "linear" }} />
              <ScanLine size={48} color="var(--accent)" className="pulse" />
              <div style={{ fontWeight: 600, color: "var(--accent)" }}>Gemini is reading your bahi...</div>
            </motion.div>
          ) : (
            <motion.div key="idle" className="upload-idle" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}>
              <UploadCloud size={48} color="var(--text-secondary)" />
              <div style={{ fontWeight: 600 }}>Click or drag a photo here</div>
              <div className="text-secondary" style={{ fontSize: 13 }}>JPG, PNG or WebP</div>
            </motion.div>
          )}
        </AnimatePresence>

        <input
          type="file"
          ref={fileInputRef}
          hidden
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => { handleFile(e.target.files[0]); e.target.value = ""; }}
        />
      </div>

      {result && (
        <div className={`scan-result ${result.success ? "success" : "error"}`} role="status">
          {result.success ? <CheckCircle size={18} /> : <XCircle size={18} />}
          <span>{result.message}</span>
        </div>
      )}
    </div>
  );
}
