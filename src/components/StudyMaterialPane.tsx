import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  Camera,
  FileText,
  PenLine,
  Trash2,
  Upload,
  Video,
  VideoOff,
} from 'lucide-react';
import type { Subject, TutorAttachment } from '../shared/types';

interface StudyMaterialPaneProps {
  subject: Subject;
  scratchpad: string;
  onScratchpadChange: (nextValue: string) => void;
  stagedAttachment: TutorAttachment | null;
  onStageAttachment: (attachment: TutorAttachment | null) => void;
  liveFeedActive: boolean;
  onToggleLiveFeed: (active: boolean) => void;
  onLiveFrameCapture: (frame: TutorAttachment) => void;
  onAskAboutNotes?: () => void;
}

type MaterialTab = 'scratchpad' | 'upload' | 'camera';

const SCRATCHPAD_PLACEHOLDERS: Record<Subject, string> = {
  Math: 'Write your math steps or problem here...\nExample:\n2x + 5 = 17\nStep 1: ...',
  Science: 'Write or paste your lab notes, question, or idea here...',
  Writing: 'Paste your paragraph, outline, or draft here...',
  Coding: 'Paste your code, bug, or error message here...',
  Language: 'Paste a sentence, story, or word list here...',
  History: 'Write your timeline notes, reading quote, or essay idea here...',
};

export const StudyMaterialPane: React.FC<StudyMaterialPaneProps> = ({
  subject,
  scratchpad,
  onScratchpadChange,
  stagedAttachment,
  onStageAttachment,
  liveFeedActive,
  onToggleLiveFeed,
  onLiveFrameCapture,
  onAskAboutNotes,
}) => {
  const [activeTab, setActiveTab] = useState<MaterialTab>('scratchpad');
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Clean up camera stream on unmount
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [cameraStream]);

  // Attach MediaStream to <video> whenever available
  useEffect(() => {
    if (videoRef.current && cameraStream) {
      videoRef.current.srcObject = cameraStream;
    }
  }, [cameraStream, activeTab]);

  // Periodically capture live video frame when Live Video Help is active
  useEffect(() => {
    if (!liveFeedActive || !cameraStream) return;
    const captureFrame = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2) return;
      const width = Math.min(720, video.videoWidth || 640);
      const height = Math.round(
        (width / Math.max(1, video.videoWidth || 640)) *
          (video.videoHeight || 480)
      );
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, width, height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.68);
      onLiveFrameCapture({
        id: `live_${Date.now()}`,
        name: 'Live notebook camera frame',
        mimeType: 'image/jpeg',
        dataUrl,
        source: 'live-frame',
      });
    };

    captureFrame();
    const timer = window.setInterval(captureFrame, 4000);
    return () => window.clearInterval(timer);
  }, [liveFeedActive, cameraStream, onLiveFrameCapture]);

  const compressImageFile = (file: File): Promise<{ dataUrl: string; mimeType: string }> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Could not read the selected image.'));
      reader.onload = () => {
        const rawUrl = typeof reader.result === 'string' ? reader.result : '';
        if (!rawUrl) {
          reject(new Error('Could not read the selected image.'));
          return;
        }
        const img = new Image();
        img.onerror = () => resolve({ dataUrl: rawUrl, mimeType: file.type || 'image/png' });
        img.onload = () => {
          const maxDim = 1024;
          const scale = Math.min(1, maxDim / Math.max(img.width || 1, img.height || 1));
          const targetW = Math.max(1, Math.round((img.width || 640) * scale));
          const targetH = Math.max(1, Math.round((img.height || 480) * scale));
          const canvas = document.createElement('canvas');
          canvas.width = targetW;
          canvas.height = targetH;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve({ dataUrl: rawUrl, mimeType: file.type || 'image/png' });
            return;
          }
          ctx.drawImage(img, 0, 0, targetW, targetH);
          resolve({
            dataUrl: canvas.toDataURL('image/jpeg', 0.78),
            mimeType: 'image/jpeg',
          });
        };
        img.src = rawUrl;
      };
      reader.readAsDataURL(file);
    });

  const startCamera = async () => {
    setCameraError(null);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError(
        'Camera access is not supported in this browser environment. You can still upload a photo of your work in the Upload tab.'
      );
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      stream.getTracks().forEach((track) => {
        track.onended = () => {
          onToggleLiveFeed(false);
          setCameraStream(null);
        };
      });
      setCameraStream(stream);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Permission denied or no camera found.';
      setCameraError(
        `Could not start camera (${msg}). Check camera permissions or upload an image file instead.`
      );
    }
  };

  const stopCamera = () => {
    onToggleLiveFeed(false);
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => {
        track.onended = null;
        track.stop();
      });
      setCameraStream(null);
    }
  };

  const handleSnapPhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return;
    const width = Math.min(1200, video.videoWidth || 800);
    const height = Math.round(
      (width / Math.max(1, video.videoWidth || 800)) *
        (video.videoHeight || 600)
    );
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, width, height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    onStageAttachment({
      id: `snap_${Date.now()}`,
      name: `Notebook snapshot (${new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })})`,
      mimeType: 'image/jpeg',
      dataUrl,
      source: 'camera-snap',
    });
  };

  const handleFileSelected = async (file: File | undefined) => {
    if (!file) return;
    setUploadError(null);

    const maxBytes = 8 * 1024 * 1024;
    if (file.size > maxBytes) {
      setUploadError('Please choose a file smaller than 8 MB.');
      return;
    }

    const isImage = file.type.startsWith('image/');
    const isPdf = file.type === 'application/pdf';
    const isText =
      file.type.startsWith('text/') ||
      /\.(txt|md|py|js|ts|tsx|jsx|csv|json|java|cpp|c|html|css)$/i.test(
        file.name
      );

    if (!isImage && !isPdf && !isText) {
      setUploadError(
        'Supported files: PNG/JPG/WebP images, PDFs, or plain text/code files.'
      );
      return;
    }

    if (isText) {
      try {
        const textContent = await file.text();
        onStageAttachment({
          id: `file_${Date.now()}`,
          name: file.name,
          mimeType: 'text/plain',
          textPreview: textContent.slice(0, 8000),
          source: 'upload',
        });
      } catch {
        setUploadError('Could not read that text file.');
      }
      return;
    }

    if (isImage) {
      try {
        const compressed = await compressImageFile(file);
        onStageAttachment({
          id: `file_${Date.now()}`,
          name: file.name,
          mimeType: compressed.mimeType,
          dataUrl: compressed.dataUrl,
          source: 'upload',
        });
      } catch (err) {
        setUploadError(
          err instanceof Error ? err.message : 'Could not process the selected image.'
        );
      }
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => {
      setUploadError('Could not read the selected file.');
    };
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      if (!result) {
        setUploadError('Could not read the selected file.');
        return;
      }
      onStageAttachment({
        id: `file_${Date.now()}`,
        name: file.name,
        mimeType: file.type || 'application/pdf',
        dataUrl: result,
        source: 'upload',
      });
    };
    reader.readAsDataURL(file);
  };

  return (
    <section
      aria-label="Study material workspace"
      className="flex flex-col h-full bg-white/95 border border-blue-200 rounded-xl shadow-sm overflow-hidden"
    >
      <div className="px-4 py-3 border-b border-blue-200/80 flex items-center justify-between gap-4 bg-gradient-to-r from-[#eff6ff] via-[#f0f9ff] to-[#eef2ff] shrink-0">
        <div
          role="tablist"
          aria-label="Study material tools"
          className="flex items-center gap-1 p-1 bg-blue-100/80 rounded-lg"
        >
          {(
            [
              { id: 'scratchpad', label: 'Notes', Icon: PenLine },
              { id: 'upload', label: 'Upload', Icon: Upload },
              { id: 'camera', label: 'Camera', Icon: Camera },
            ] as const
          ).map(({ id, label, Icon }) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveTab(id)}
                className={`relative px-3 py-1.5 text-xs font-semibold rounded-md inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'text-white'
                    : 'text-blue-900/75 hover:text-blue-950'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="material-tab-pill"
                    transition={{ type: 'spring', stiffness: 420, damping: 30 }}
                    className="absolute inset-0 rounded-md bg-gradient-to-r from-[#1d4ed8] to-[#0284c7] shadow-sm"
                  />
                )}
                <Icon className="w-3.5 h-3.5 relative z-10" />
                <span className="relative z-10">{label}</span>
              </button>
            );
          })}
        </div>

        {onAskAboutNotes && scratchpad.trim().length > 0 ? (
          <motion.button
            type="button"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={onAskAboutNotes}
            className="text-xs font-semibold text-blue-700 hover:text-blue-900 hover:underline whitespace-nowrap shrink-0"
          >
            Ask Tutor About Notes
          </motion.button>
        ) : (
          <span className="text-xs text-blue-800/70 whitespace-nowrap shrink-0 hidden 2xl:inline">
            Live sync on
          </span>
        )}
      </div>

      <div className="flex-1 min-h-0 flex flex-col p-4 overflow-y-auto bg-gradient-to-b from-white to-[#f6faff]">
        {activeTab === 'scratchpad' && (
          <motion.div
            key="scratchpad"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.16 }}
            className="flex-1 flex flex-col gap-3 min-h-0"
          >
              <div className="flex items-center justify-between gap-2 text-xs text-slate-600">
                <span>
                  Everyone in this room sees these notes, and your tutor reads them too.
                </span>
                <span className="font-mono tabular-nums text-blue-800/70 shrink-0">
                  {scratchpad.length} chars
                </span>
              </div>
              <label htmlFor="shared-scratchpad" className="sr-only">
                Shared study notes
              </label>
              <textarea
                id="shared-scratchpad"
                value={scratchpad}
                onChange={(e) => onScratchpadChange(e.target.value)}
                placeholder={SCRATCHPAD_PLACEHOLDERS[subject]}
                className="flex-1 min-h-[260px] w-full p-4 bg-[#f4f9ff] border border-blue-200 rounded-lg font-mono text-sm leading-relaxed text-slate-800 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500"
              />
            </motion.div>
          )}

          {activeTab === 'upload' && (
            <motion.div
              key="upload"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.16 }}
              className="flex-1 flex flex-col gap-4"
            >
              <motion.div
                whileHover={{ scale: 1.005 }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  void handleFileSelected(e.dataTransfer.files[0]);
                }}
                className="border border-dashed border-sky-300 rounded-xl bg-sky-50/60 p-8 text-center space-y-3"
              >
                <div className="w-10 h-10 rounded-lg bg-white border border-sky-200 mx-auto flex items-center justify-center text-blue-700 shadow-xs">
                  <Upload className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-[#0f294d]">
                    Upload photos, PDFs, or code files
                  </p>
                  <p className="text-xs text-slate-600">
                    Works with PNG, JPG, PDF, and text/code files up to 8 MB
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.pdf,.txt,.md,.py,.js,.ts,.tsx,.jsx,.csv"
                  onChange={(e) => void handleFileSelected(e.target.files?.[0])}
                  className="sr-only"
                  id="study-file-upload"
                />
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => fileInputRef.current?.click()}
                  className="min-h-[40px] px-4 py-2 bg-gradient-to-r from-[#1d4ed8] to-[#0284c7] hover:from-[#1e40af] hover:to-[#0369a1] text-white text-sm font-semibold rounded-lg transition-all shadow-sm"
                >
                  Choose File
                </motion.button>
              </motion.div>

              {uploadError && (
                <div
                  role="alert"
                  className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800"
                >
                  {uploadError}
                </div>
              )}

              {stagedAttachment && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="border border-blue-200 rounded-xl p-4 space-y-3 bg-white"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="w-4 h-4 text-teal-600 shrink-0" />
                      <span className="text-sm font-medium text-slate-900 truncate">
                        {stagedAttachment.name}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onStageAttachment(null)}
                      aria-label="Remove attached file"
                      className="p-1.5 text-slate-500 hover:text-red-700 rounded-lg hover:bg-slate-100 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {stagedAttachment.dataUrl &&
                    stagedAttachment.mimeType.startsWith('image/') && (
                      <img
                        src={stagedAttachment.dataUrl}
                        alt={stagedAttachment.name}
                        className="max-h-72 w-full object-contain rounded-lg border border-blue-100 bg-sky-50/40"
                      />
                    )}

                  {stagedAttachment.mimeType === 'application/pdf' && (
                    <p className="text-xs text-slate-700 bg-sky-50 p-3 rounded-lg border border-sky-200">
                      PDF document attached and ready. Ask a question in the chat to
                      walk through any section or problem inside it.
                    </p>
                  )}

                  {stagedAttachment.textPreview && (
                    <pre className="max-h-60 overflow-auto p-3 rounded-lg bg-[#f4f9ff] border border-blue-200 text-xs font-mono text-slate-800 whitespace-pre-wrap">
                      {stagedAttachment.textPreview}
                    </pre>
                  )}
                </motion.div>
              )}
            </motion.div>
          )}

          {activeTab === 'camera' && (
            <motion.div
              key="camera"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.16 }}
              className="flex-1 flex flex-col gap-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {!cameraStream ? (
                    <motion.button
                      type="button"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={startCamera}
                      className="min-h-[40px] px-4 py-2 bg-gradient-to-r from-[#1d4ed8] to-[#0284c7] hover:from-[#1e40af] hover:to-[#0369a1] text-white text-xs font-semibold rounded-lg inline-flex items-center gap-2 transition-all whitespace-nowrap shrink-0 shadow-sm"
                    >
                      <Video className="w-4 h-4" />
                      <span>Enable Camera</span>
                    </motion.button>
                  ) : (
                    <>
                      <motion.button
                        type="button"
                        whileTap={{ scale: 0.96 }}
                        onClick={handleSnapPhoto}
                        className="min-h-[40px] px-4 py-2 bg-gradient-to-r from-[#1d4ed8] to-[#0284c7] text-white text-xs font-semibold rounded-lg inline-flex items-center gap-2 transition-all whitespace-nowrap shrink-0 shadow-sm"
                      >
                        <Camera className="w-4 h-4" />
                        <span>Snap Photo</span>
                      </motion.button>
                      <motion.button
                        type="button"
                        whileTap={{ scale: 0.96 }}
                        onClick={() => onToggleLiveFeed(!liveFeedActive)}
                        aria-pressed={liveFeedActive}
                        className={`min-h-[40px] px-3.5 py-2 text-xs font-semibold rounded-lg border inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 ${
                          liveFeedActive
                            ? 'bg-teal-600 border-teal-600 text-white'
                            : 'bg-white border-blue-200 text-blue-900 hover:bg-blue-50'
                        }`}
                      >
                        <span>
                          {liveFeedActive ? 'Live Camera On' : 'Live Video'}
                        </span>
                      </motion.button>
                      <button
                        type="button"
                        onClick={stopCamera}
                        className="min-h-[40px] px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 border border-blue-200 rounded-lg inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
                      >
                        <VideoOff className="w-4 h-4" />
                        <span>Stop</span>
                      </button>
                    </>
                  )}
                </div>
              </div>

              {cameraError && (
                <div
                  role="alert"
                  className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900"
                >
                  {cameraError}
                </div>
              )}

              <div className="relative flex-1 min-h-[240px] bg-gradient-to-br from-[#0f294d] to-[#173f78] rounded-xl overflow-hidden flex items-center justify-center border border-blue-300/60">
                {cameraStream ? (
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-contain max-h-[360px]"
                  />
                ) : (
                  <div className="text-center p-6 space-y-2 text-blue-100">
                    <Camera className="w-8 h-8 mx-auto text-sky-300" />
                    <p className="text-sm font-medium text-white">
                      Show your notebook or book
                    </p>
                    <p className="text-xs text-blue-200 max-w-xs mx-auto">
                      Take a photo of handwritten work, or turn on Live Video so
                      your tutor sees updates as you write.
                    </p>
                  </div>
                )}
              </div>

              <canvas ref={canvasRef} className="hidden" />
            </motion.div>
          )}
      </div>
    </section>
  );
};
