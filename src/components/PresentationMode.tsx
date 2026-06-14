import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { 
  BookOpen, 
  Users, 
  Download, 
  RefreshCw, 
  CheckCircle, 
  Plus, 
  Trash2, 
  ArrowLeft, 
  Camera, 
  Laptop, 
  TableProperties,
  ArrowRight,
  Clipboard,
  Smartphone,
  Maximize2,
  X
} from 'lucide-react';

interface PresentationStudent {
  id: string;
  name: string;
  course: string;
  semester: string;
  enrolledAt: string;
}

interface PresentationAttendance {
  id: string;
  studentId: string;
  studentName: string;
  course: string;
  semester: string;
  scannedAt: string;
  tokenUsed: string;
}

interface PresentationModeProps {
  onBack: () => void;
  initialOverrideMode?: 'presenter' | 'student';
}

export default function PresentationMode({ onBack, initialOverrideMode }: PresentationModeProps) {
  // Lock students in if they scan the presentation QR containing ?mode=apresentacao_aluno
  const isLockedStudent = (() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      return urlParams.get('mode') === 'apresentacao_aluno';
    } catch {
      return false;
    }
  })();

  // Determine if we start as presenter or student (mobile user)
  const [role, setRole] = useState<'presenter' | 'student'>(() => {
    if (isLockedStudent) return 'student';
    if (initialOverrideMode) return initialOverrideMode;
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('mode') === 'apresentacao_aluno' ? 'student' : 'presenter';
  });

  // Server state
  const [activeToken, setActiveToken] = useState<string>(() => {
    return localStorage.getItem('onclass_pres_active_token') || 'LIVE-ON95';
  });
  const [timeLeftMs, setTimeLeftMs] = useState<number>(10000);
  const [students, setStudents] = useState<PresentationStudent[]>(() => {
    try {
      const saved = localStorage.getItem('onclass_pres_students');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [attendances, setAttendances] = useState<PresentationAttendance[]>(() => {
    try {
      const saved = localStorage.getItem('onclass_pres_attendances');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [activeNotification, setActiveNotification] = useState<string | null>(null);
  const [isServerOffline, setIsServerOffline] = useState<boolean>(false);

  // Student specific interface states
  const [studentName, setStudentName] = useState('');
  const [studentCourse, setStudentCourse] = useState('');
  const [studentSemester, setStudentSemester] = useState('1º Semestre');
  const [currentStudent, setCurrentStudent] = useState<PresentationStudent | null>(() => {
    try {
      const saved = localStorage.getItem('onclass_pres_active_student');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [manualCode, setManualCode] = useState('');
  const [scanStatus, setScanStatus] = useState<{ type: 'idle' | 'success' | 'error'; message: string }>({
    type: 'idle',
    message: ''
  });

  const hasAlreadyCheckedIn = (() => {
    if (!currentStudent) return false;
    const inState = attendances.some(a => a.studentId === currentStudent.id);
    if (inState) return true;
    try {
      if (localStorage.getItem(`onclass_pres_submitted_${currentStudent.id}`) === 'true') {
        return true;
      }
    } catch {}
    return false;
  })();

  const [copiedLink, setCopiedLink] = useState(false);
  const [expandedQr, setExpandedQr] = useState<'enrollment' | 'token' | null>(null);

  // Real Camera Scanner states
  const [cameraPermissionError, setCameraPermissionError] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);

  // Real Camera Scanner hook
  useEffect(() => {
    if (role !== 'student' || !currentStudent || hasAlreadyCheckedIn || scanStatus.type === 'success') {
      return;
    }

    const containerId = "qr-reader-container";
    let html5QrCode: Html5Qrcode | null = null;
    let isStarted = false;

    // Small delay to ensure the container div is fully rendered in DOM
    const startTimeout = setTimeout(() => {
      const element = document.getElementById(containerId);
      if (!element) return;

      try {
        html5QrCode = new Html5Qrcode(containerId);
        html5QrCode.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: (width, height) => {
              const size = Math.min(width, height) * 0.7;
              return { width: Math.max(160, size), height: Math.max(160, size) };
            }
          },
          (decodedText) => {
            console.log("Scanned successfully:", decodedText);
            // Check if the decoded link is a full URL or just the code
            let tokenValue = decodedText;
            try {
              // If student accidentally scanned QR 1 instead of QR 2, handle gracefully
              if (decodedText.includes("mode=apresentacao_aluno")) {
                const urlObj = new URL(decodedText);
                const roomParam = urlObj.searchParams.get("room");
                if (roomParam) {
                  alert(`Você escaneou o QR Code do Cadastro (Passo 1).\nPor favor, aponte para o QR Code de Validação (Passo 2) com o código de 10 segundos!`);
                  return;
                }
              }
            } catch (e) {}

            handleScanOrSubmitCode(tokenValue);
          },
          () => {
            // silent scan fail for noisy frames
          }
        ).then(() => {
          isStarted = true;
          setIsCameraActive(true);
          setCameraPermissionError(null);
        }).catch((err) => {
          console.warn("Camera start failed:", err);
          setCameraPermissionError("Não foi possível acessar a câmera do aparelho. Conceda permissão ou insira o código manualmente.");
          setIsCameraActive(false);
        });
      } catch (e) {
        console.error("Html5Qrcode init error:", e);
      }
    }, 400);

    return () => {
      clearTimeout(startTimeout);
      if (html5QrCode) {
        if (isStarted) {
          html5QrCode.stop().then(() => {
            setIsCameraActive(false);
          }).catch(err => {
            console.warn("Failed to stop camera:", err);
          });
        }
      }
    };
  }, [role, currentStudent, hasAlreadyCheckedIn, scanStatus.type]);

  // Dynamic Room Code that maps the cross-device Cloud Sync room to prevent data separation on headless serverless deploys (like Vercel)
  const [roomCode] = useState<string>(() => {
    try {
      const urlParams = new URL(new URL(window.location.href)).searchParams;
      const urlRoom = urlParams.get('room');
      if (urlRoom) {
        localStorage.setItem('onclass_pres_room_code', urlRoom.toUpperCase());
        return urlRoom.toUpperCase();
      }
      const saved = localStorage.getItem('onclass_pres_room_code');
      if (saved) return saved;
      const randCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      localStorage.setItem('onclass_pres_room_code', randCode);
      return randCode;
    } catch {
      return 'ROOM95';
    }
  });

  // Helpers to read/write state with a highly-reliable CORS-enabled public bucket fallback
  const fetchCloudKVState = async (room: string) => {
    try {
      const res = await fetch(`https://kvdb.io/jXGg8p24RDe42uX6iZz8t87b/room_${room}`);
      if (res.ok) {
        const text = await res.text();
        if (text && text.trim()) {
          return JSON.parse(text);
        }
      }
    } catch (e) {
      console.warn("KV Cloud read error", e);
    }
    return null;
  };

  const writeCloudKVState = async (room: string, state: any) => {
    try {
      await fetch(`https://kvdb.io/jXGg8p24RDe42uX6iZz8t87b/room_${room}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(state)
      });
    } catch (e) {
      console.warn("KV Cloud write error", e);
    }
  };

  // Live Slide sharing states
  const [slides, setSlides] = useState<{ id: string; title: string; imageUrl: string }[]>(() => {
    try {
      const saved = localStorage.getItem('onclass_pres_slides');
      return saved ? JSON.parse(saved) : [
        {
          id: "slide-1",
          title: "1. Bem-vindo ao OnClass Test!",
          imageUrl: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=1000&auto=format&fit=crop&q=80"
        },
        {
          id: "slide-2",
          title: "2. Cadastro Simples de Alunos",
          imageUrl: "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=1000&auto=format&fit=crop&q=80"
        },
        {
          id: "slide-3",
          title: "3. Validação com Token Rotativo de 10s",
          imageUrl: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=1000&auto=format&fit=crop&q=80"
        },
        {
          id: "slide-4",
          title: "4. Registro Seguro Contrafraude",
          imageUrl: "https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=1000&auto=format&fit=crop&q=80"
        }
      ];
    } catch {
      return [];
    }
  });

  const [activeSlideIndex, setActiveSlideIndex] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('onclass_pres_active_slide_index');
      return saved ? Number(saved) : 0;
    } catch {
      return 0;
    }
  });

  const changeActiveSlide = async (index: number) => {
    setActiveSlideIndex(index);
    try {
      localStorage.setItem('onclass_pres_active_slide_index', String(index));
      
      // Cloud Sync fallback
      if (isServerOffline) {
        const cloudState = await fetchCloudKVState(roomCode) || {
          activeToken,
          students: [],
          attendances: [],
          slides
        };
        cloudState.activeSlideIndex = index;
        cloudState.lastUpdated = Date.now();
        await writeCloudKVState(roomCode, cloudState);
      }

      const res = await fetch('/api/presentation/slides/active', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ index }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.activeSlideIndex !== undefined) {
          setActiveSlideIndex(data.activeSlideIndex);
        }
      }
    } catch (e) {
      console.warn("Error setting slide on server, standard fallback active", e);
    }
  };

  const addSlide = async (title: string, imageUrl: string) => {
    const tempSlides = [
      ...slides,
      {
        id: "slide-" + Math.random().toString(36).substring(2, 9),
        title,
        imageUrl,
      }
    ];
    setSlides(tempSlides);
    localStorage.setItem('onclass_pres_slides', JSON.stringify(tempSlides));

    // Cloud Sync fallback
    if (isServerOffline) {
      try {
        const cloudState = await fetchCloudKVState(roomCode) || {
          activeToken,
          activeSlideIndex,
          students: [],
          attendances: [],
          slides
        };
        cloudState.slides = tempSlides;
        cloudState.lastUpdated = Date.now();
        await writeCloudKVState(roomCode, cloudState);
      } catch (e) {
        console.warn(e);
      }
    }

    try {
      const res = await fetch('/api/presentation/slides/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, imageUrl }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.slides) {
          setSlides(data.slides);
          localStorage.setItem('onclass_pres_slides', JSON.stringify(data.slides));
        }
      }
    } catch (e) {
      console.warn("Could not add slide to server", e);
    }
  };

  const deleteSlide = async (id: string) => {
    if (slides.length <= 1) return;
    const tempSlides = slides.filter(s => s.id !== id);
    let nextIndex = activeSlideIndex;
    if (nextIndex >= tempSlides.length) {
      nextIndex = tempSlides.length - 1;
    }
    setSlides(tempSlides);
    setActiveSlideIndex(nextIndex);
    localStorage.setItem('onclass_pres_slides', JSON.stringify(tempSlides));
    localStorage.setItem('onclass_pres_active_slide_index', String(nextIndex));

    // Cloud Sync fallback
    if (isServerOffline) {
      try {
        const cloudState = await fetchCloudKVState(roomCode) || {
          activeToken,
          students: [],
          attendances: []
        };
        cloudState.slides = tempSlides;
        cloudState.activeSlideIndex = nextIndex;
        cloudState.lastUpdated = Date.now();
        await writeCloudKVState(roomCode, cloudState);
      } catch (e) {
        console.warn(e);
      }
    }

    try {
      const res = await fetch('/api/presentation/slides/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.slides) {
          setSlides(data.slides);
          setActiveSlideIndex(data.activeSlideIndex ?? 0);
          localStorage.setItem('onclass_pres_slides', JSON.stringify(data.slides));
          localStorage.setItem('onclass_pres_active_slide_index', String(data.activeSlideIndex ?? 0));
        }
      }
    } catch (e) {
      console.warn("Could not delete slide from server", e);
    }
  };

  // Auto-derived student link
  const getStudentShareUrl = () => {
    const origin = window.location.origin + window.location.pathname;
    return `${origin}?mode=apresentacao_aluno&room=${roomCode}`;
  };

  // Poll server state every 1.5 seconds if presenter to get instant attendee scans
  useEffect(() => {
    let intervalId: any;

    const fetchStatus = async () => {
      try {
        const res = await fetch('/api/presentation/status');
        if (res.ok) {
          const data = await res.json();
          setIsServerOffline(false);
          
          // Check if there is a new attendance to show a pop notification on teacher screen
          if (attendances.length > 0 && data.attendances.length > attendances.length) {
            const newAttendance = data.attendances[0];
            setActiveNotification(`🎉 ${newAttendance.studentName} acabou de confirmar presença!`);
            setTimeout(() => setActiveNotification(null), 4000);
          }

          setActiveToken(data.activeToken);
          setTimeLeftMs(data.timeLeftMs);
          setStudents(data.students || []);
          setAttendances(data.attendances || []);
          
          if (data.slides) {
            setSlides(data.slides);
            localStorage.setItem('onclass_pres_slides', JSON.stringify(data.slides));
          }
          if (data.activeSlideIndex !== undefined) {
            setActiveSlideIndex(data.activeSlideIndex);
            localStorage.setItem('onclass_pres_active_slide_index', String(data.activeSlideIndex));
          }
          
          // Sync to localStorage
          localStorage.setItem('onclass_pres_students', JSON.stringify(data.students || []));
          localStorage.setItem('onclass_pres_attendances', JSON.stringify(data.attendances || []));
          localStorage.setItem('onclass_pres_active_token', data.activeToken);
        } else {
          throw new Error("Server not ok");
        }
      } catch (err) {
        setIsServerOffline(true);
        console.warn("Express real-time server offline. Syncing from public room:", roomCode);
        
        // Dynamically request cross-device Cloud Sync fallback so it works 100% on Vercel static/serverless
        try {
          const cloudState = await fetchCloudKVState(roomCode);
          if (cloudState) {
            if (attendances.length > 0 && cloudState.attendances && cloudState.attendances.length > attendances.length) {
              const newAttendance = cloudState.attendances[0];
              setActiveNotification(`🎉 ${newAttendance.studentName} acabou de confirmar presença!`);
              setTimeout(() => setActiveNotification(null), 4000);
            }

            if (cloudState.activeToken) {
              setActiveToken(cloudState.activeToken);
              localStorage.setItem('onclass_pres_active_token', cloudState.activeToken);
            }
            if (cloudState.previousToken) {
              localStorage.setItem('onclass_pres_previous_token', cloudState.previousToken);
            }
            if (cloudState.students) {
              setStudents(cloudState.students);
              localStorage.setItem('onclass_pres_students', JSON.stringify(cloudState.students));
            }
            if (cloudState.attendances) {
              setAttendances(cloudState.attendances);
              localStorage.setItem('onclass_pres_attendances', JSON.stringify(cloudState.attendances));
            }
            if (cloudState.activeSlideIndex !== undefined) {
              setActiveSlideIndex(cloudState.activeSlideIndex);
              localStorage.setItem('onclass_pres_active_slide_index', String(cloudState.activeSlideIndex));
            }
            if (cloudState.slides) {
              setSlides(cloudState.slides);
              localStorage.setItem('onclass_pres_slides', JSON.stringify(cloudState.slides));
            }
          } else {
            // Initialize the room on public cloud store
            const freshState = {
              activeToken,
              activeSlideIndex,
              students: [],
              attendances: [],
              slides,
              lastUpdated: Date.now()
            };
            await writeCloudKVState(roomCode, freshState);
          }
        } catch (e) {
          console.warn("Local storage lookup fallback during severe offline:", e);
          try {
            const savedStudents = localStorage.getItem('onclass_pres_students');
            const savedAttendances = localStorage.getItem('onclass_pres_attendances');
            const localStudents = savedStudents ? JSON.parse(savedStudents) : [];
            const localAttendances = savedAttendances ? JSON.parse(savedAttendances) : [];
            
            if (localAttendances.length > attendances.length) {
              const newAttendance = localAttendances[0];
              setActiveNotification(`🎉 ${newAttendance.studentName} acabou de confirmar presença!`);
              setTimeout(() => setActiveNotification(null), 4000);
            }
            
            setStudents(localStudents);
            setAttendances(localAttendances);

            const savedSlides = localStorage.getItem('onclass_pres_slides');
            const savedActiveIndex = localStorage.getItem('onclass_pres_active_slide_index');
            if (savedSlides) setSlides(JSON.parse(savedSlides));
            if (savedActiveIndex !== null) setActiveSlideIndex(Number(savedActiveIndex));
          } catch (storageErr) {
            console.warn("Storage fallback failed too", storageErr);
          }
        }
      }
    };

    // Initial fetch
    fetchStatus();

    // Start polling
    intervalId = setInterval(fetchStatus, 1500);

    return () => clearInterval(intervalId);
  }, [attendances.length, roomCode]);

  // Synchronize dynamic circle SVG timer count as milliseconds deplete
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeftMs((prev) => {
        if (prev <= 100) {
          if (isServerOffline && role === 'presenter') {
            // Generate a brand new token client-side with 10s rotation as fallback!
            const chars = "ABCDEFGHJKLMNOPQRSTUVWXYZ23456789"; 
            let code = "LIVE-";
            for (let i = 0; i < 4; i++) {
              code += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            localStorage.setItem('onclass_pres_active_token', code);
            setActiveToken(code);

            // Fetch and update token in Cloud Sync
            try {
              fetchCloudKVState(roomCode).then((cloudState) => {
                if (cloudState) {
                  const currentActive = cloudState.activeToken || 'LIVE-ON95';
                  localStorage.setItem('onclass_pres_previous_token', currentActive);
                  cloudState.previousToken = currentActive;
                  cloudState.activeToken = code;
                  cloudState.lastUpdated = Date.now();
                  writeCloudKVState(roomCode, cloudState);
                }
              });
            } catch (e) {
              console.warn(e);
            }
          }
          return 10000;
        }
        return prev - 100;
      });
    }, 100);
    return () => clearInterval(interval);
  }, [isServerOffline, roomCode]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(getStudentShareUrl());
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  // Handle student enrollment registration
  const handleEnrollStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentName.trim() || !studentCourse.trim()) {
      alert("Por favor, preencha o seu e-mail/nome e curso.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/presentation/enroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: studentName,
          course: studentCourse,
          semester: studentSemester
        })
      });

      const data = await res.json();
      setIsLoading(false);

      if (res.ok && data.success) {
        setCurrentStudent(data.student);
        localStorage.setItem('onclass_pres_active_student', JSON.stringify(data.student));
        setScanStatus({ type: 'idle', message: '' });
      } else {
        alert(data.error || "Erro ao registrar participação.");
      }
    } catch (err) {
      setIsLoading(false);
      // Fallback local mock simulation if server is offline
      const mockStudent: PresentationStudent = {
        id: 'mock-std-' + Math.random().toString(36).substring(2, 7),
        name: studentName,
        course: studentCourse,
        semester: studentSemester,
        enrolledAt: new Date().toISOString()
      };
      setCurrentStudent(mockStudent);
      localStorage.setItem('onclass_pres_active_student', JSON.stringify(mockStudent));
      
      // Save student to the Cloud Sync room
      try {
        const cloudState = await fetchCloudKVState(roomCode) || {
          activeToken,
          activeSlideIndex,
          students: [],
          attendances: [],
          slides
        };
        if (!cloudState.students) cloudState.students = [];
        if (!cloudState.students.some((s: any) => s.id === mockStudent.id)) {
          cloudState.students.push(mockStudent);
          cloudState.lastUpdated = Date.now();
          await writeCloudKVState(roomCode, cloudState);
        }
        
        localStorage.setItem('onclass_pres_students', JSON.stringify(cloudState.students));
      } catch (e) {
        console.warn("Could not sync registration to Cloud Sync room:", e);
        
        // Final fallback to local students
        try {
          const saved = localStorage.getItem('onclass_pres_students');
          const list = saved ? JSON.parse(saved) : [];
          list.push(mockStudent);
          localStorage.setItem('onclass_pres_students', JSON.stringify(list));
        } catch (storageErr) {
          console.warn(storageErr);
        }
      }
    }
  };

  // Handle student scanning/submitting code
  const handleScanOrSubmitCode = async (codeToSubmit: string) => {
    if (!currentStudent) return;
    if (hasAlreadyCheckedIn) {
      alert("Você já registrou sua presença nesta apresentação!");
      return;
    }
    if (!codeToSubmit.trim()) {
      setScanStatus({ type: 'error', message: 'Por favor, informe o token de 4 letras do projetor.' });
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/presentation/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: currentStudent.id,
          token: codeToSubmit.trim().toUpperCase()
        })
      });

      const data = await res.json();
      setIsLoading(false);

      if (res.ok && data.success) {
        try {
          localStorage.setItem(`onclass_pres_submitted_${currentStudent.id}`, 'true');
        } catch {}
        setScanStatus({ 
          type: 'success', 
          message: data.message || 'Presença confirmada no dashboard do professor!' 
        });
        setManualCode('');
      } else {
        setScanStatus({ 
          type: 'error', 
          message: data.error || 'Token incorreto ou expirado. Aguarde o próximo código!' 
        });
      }
    } catch (err) {
      setIsLoading(false);
      
      const upperToken = codeToSubmit.trim().toUpperCase();
      
      try {
        const cloudState = await fetchCloudKVState(roomCode) || {
          activeToken: localStorage.getItem('onclass_pres_active_token') || 'LIVE-ON95',
          activeSlideIndex: 0,
          students: [],
          attendances: [],
          slides
        };

        const currentTokenStored = cloudState.activeToken || 'LIVE-ON95';
        const previousTokenStored = cloudState.previousToken || localStorage.getItem('onclass_pres_previous_token') || '';
        const isTokenValid = upperToken === currentTokenStored || upperToken === previousTokenStored || upperToken === 'LIVE-ON95';

        if (!isTokenValid) {
          setScanStatus({ 
            type: 'error', 
            message: 'QR Code Expirado ou Código Inválido! Tente novamente com o código atualizado de 10s.' 
          });
          return;
        }

        const newAttendance: PresentationAttendance = {
          id: 'att-mock-' + Math.random().toString(36).substring(2, 7),
          studentId: currentStudent.id,
          studentName: currentStudent.name,
          course: currentStudent.course,
          semester: currentStudent.semester,
          scannedAt: new Date().toISOString(),
          tokenUsed: upperToken
        };

        if (!cloudState.students) cloudState.students = [];
        if (!cloudState.students.some((s: any) => s.id === currentStudent.id)) {
          cloudState.students.push(currentStudent);
        }

        if (!cloudState.attendances) cloudState.attendances = [];
        if (!cloudState.attendances.some((a: any) => a.studentId === currentStudent.id)) {
          cloudState.attendances.unshift(newAttendance);
        }

        cloudState.lastUpdated = Date.now();
        await writeCloudKVState(roomCode, cloudState);

        // sync values to state on the phone view
        setStudents(cloudState.students);
        setAttendances(cloudState.attendances);

        localStorage.setItem('onclass_pres_students', JSON.stringify(cloudState.students));
        localStorage.setItem('onclass_pres_attendances', JSON.stringify(cloudState.attendances));
        localStorage.setItem(`onclass_pres_submitted_${currentStudent.id}`, 'true');

        setScanStatus({ 
          type: 'success', 
          message: 'Presença confirmada no dashboard do professor (Sincronizado via Cloud Sync)!' 
        });
        setManualCode('');

      } catch (e) {
        console.warn("Could not register attendance check-in on Cloud Sync:", e);
        
        // Offline absolute fallback
        const currentTokenStored = localStorage.getItem('onclass_pres_active_token') || 'LIVE-ON95';
        const previousTokenStored = localStorage.getItem('onclass_pres_previous_token') || '';
        const isTokenValid = upperToken === currentTokenStored || upperToken === previousTokenStored || upperToken === 'LIVE-ON95';

        if (!isTokenValid) {
          setScanStatus({ 
            type: 'error', 
            message: 'QR Code Expirado ou Código Inválido! Tente novamente com o código atualizado de 10s.' 
          });
          return;
        }

        const newAttendance: PresentationAttendance = {
          id: 'att-mock-' + Math.random().toString(36).substring(2, 7),
          studentId: currentStudent.id,
          studentName: currentStudent.name,
          course: currentStudent.course,
          semester: currentStudent.semester,
          scannedAt: new Date().toISOString(),
          tokenUsed: upperToken
        };

        try {
          const savedStds = localStorage.getItem('onclass_pres_students');
          const listStds = savedStds ? JSON.parse(savedStds) : [];
          if (!listStds.some((s: any) => s.id === currentStudent.id)) {
            listStds.push(currentStudent);
            localStorage.setItem('onclass_pres_students', JSON.stringify(listStds));
          }

          const savedAtts = localStorage.getItem('onclass_pres_attendances');
          const listAtts = savedAtts ? JSON.parse(savedAtts) : [];
          if (!listAtts.some((a: any) => a.studentId === currentStudent.id)) {
            listAtts.unshift(newAttendance);
            localStorage.setItem('onclass_pres_attendances', JSON.stringify(listAtts));
          }
          
          setStudents(listStds);
          setAttendances(listAtts);
          localStorage.setItem(`onclass_pres_submitted_${currentStudent.id}`, 'true');
        } catch (storageErr) {
          console.warn(storageErr);
        }

        setScanStatus({ 
          type: 'success', 
          message: 'Presença Simulada com Sucesso no Cliente (Modo Offline)!' 
        });
        setManualCode('');
      }
    }
  };

  // Presentation Reset helper
  const handleResetData = async () => {
    if (!window.confirm("Deseja realmente limpar as participações desta simulação?")) return;
    try {
      await fetch('/api/presentation/reset', { method: 'POST' });
    } catch (err) {
      console.warn("Could not reset on server, resetting locally:", err);
    }
    setStudents([]);
    setAttendances([]);
    localStorage.removeItem('onclass_pres_students');
    localStorage.removeItem('onclass_pres_attendances');

    // Cloud Sync Fallback Reset
    if (isServerOffline) {
      try {
        const freshState = {
          activeToken,
          activeSlideIndex,
          students: [],
          attendances: [],
          slides,
          lastUpdated: Date.now()
        };
        await writeCloudKVState(roomCode, freshState);
      } catch (e) {
        console.warn(e);
      }
    }

    setActiveNotification("✨ Simulação reiniciada com sucesso!");
    setTimeout(() => setActiveNotification(null), 3550);
  };

  // Demo Student Generator
  const handleAddDemoStudent = async () => {
    const randomNames = [
      "Rodrigo Ferreira Mendes", "Amanda de Souza Lima", "Carlos Eduardo Pinho", 
      "Juliana de Moraes", "Felipe Castanhari", "Camila Vieira Santos", 
      "Beatriz Custódio", "Gustavo Henrique", "Aline Peixoto"
    ];
    const randomCourses = [
      "Engenharia de Software", "Análise e Desenv. de Sistemas", "Administração de Empresas",
      "Ciência da Computação", "Direito Constitucional", "Medicina Veterinária"
    ];
    const randomSemesters = ["1º Semestre", "3º Semestre", "5º Semestre", "8º Semestre"];

    const chosenName = randomNames[Math.floor(Math.random() * randomNames.length)];
    const chosenCourse = randomCourses[Math.floor(Math.random() * randomCourses.length)];
    const chosenSem = randomSemesters[Math.floor(Math.random() * randomSemesters.length)];

    try {
      // 1. Enroll
      const enrollRes = await fetch('/api/presentation/enroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: chosenName, course: chosenCourse, semester: chosenSem })
      });
      if (!enrollRes.ok) return;
      const enrollData = await enrollRes.json();
      
      // 2. Scan immediately using current active token
      await fetch('/api/presentation/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: enrollData.student.id, token: activeToken })
      });

    } catch (e) {
      console.warn("Could not generate mock demo student without server backend.", e);
      
      const mockStudentId = 'demo-std-' + Math.random().toString(36).substring(2, 7);
      const mockStudent: PresentationStudent = {
        id: mockStudentId,
        name: chosenName,
        course: chosenCourse,
        semester: chosenSem,
        enrolledAt: new Date().toISOString()
      };

      const newAttendance: PresentationAttendance = {
        id: 'demo-att-' + Math.random().toString(36).substring(2, 7),
        studentId: mockStudentId,
        studentName: chosenName,
        course: chosenCourse,
        semester: chosenSem,
        scannedAt: new Date().toISOString(),
        tokenUsed: activeToken
      };

      try {
        const savedStds = localStorage.getItem('onclass_pres_students');
        const listStds = savedStds ? JSON.parse(savedStds) : [];
        listStds.push(mockStudent);
        localStorage.setItem('onclass_pres_students', JSON.stringify(listStds));

        const savedAtts = localStorage.getItem('onclass_pres_attendances');
        const listAtts = savedAtts ? JSON.parse(savedAtts) : [];
        listAtts.unshift(newAttendance);
        localStorage.setItem('onclass_pres_attendances', JSON.stringify(listAtts));

        // update local state
        setStudents(listStds);
        setAttendances(listAtts);
        
        setActiveNotification(`🎉 ${chosenName} acabou de confirmar presença!`);
        setTimeout(() => setActiveNotification(null), 4000);
      } catch (err) {
        console.warn(err);
      }
    }
  };

  // Download Spreadsheet as CSV
  const handleDownloadCSV = () => {
    if (attendances.length === 0) {
      alert("Nenhum registro de presença para exportar!");
      return;
    }

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Nome Completo,Curso,Semestre,Horario de Presenca,Token Utilizado\n";

    attendances.forEach((item) => {
      const hour = new Date(item.scannedAt).toLocaleTimeString('pt-BR');
      const row = `"${item.studentName}","${item.course}","${item.semester}","${hour}","${item.tokenUsed}"`;
      csvContent += row + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `chamada_apresentacao_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Circular timer percentage
  const strokeDashoffset = (timeLeftMs / 10000) * 283;

  return (
    <div className="w-full min-h-screen bg-[#f3f7fd] flex flex-col">
      
      {/* HEADER BANNER */}
      {isLockedStudent ? (
        <header className="bg-white border-b border-blue-100 py-3 px-6 shadow-sm sticky top-0 z-40">
          <div className="max-w-lg mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse"></span>
              <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Conexão Ativa</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[11px] font-extrabold text-[#0b1c30]">OnClass</span>
              <span className="text-[10px] bg-blue-50 text-[#0066ff] py-0.5 px-2 rounded-md font-bold">
                Showcase Aluno
              </span>
            </div>
          </div>
        </header>
      ) : (
        <header className="bg-white border-b border-blue-100 py-3.5 px-6 shadow-sm sticky top-0 z-40">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={onBack}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 cursor-pointer transition-colors"
                title="Voltar ao sistema"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="h-6 w-px bg-slate-200"></div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded-md uppercase tracking-wider animate-pulse">
                    Ao Vivo
                  </span>
                  <h1 className="text-sm font-extrabold text-[#0b1c30]">OnClass Test Showcase</h1>
                </div>
                <p className="text-[10px] text-slate-500 font-medium">Demonstração Interativa em Tempo Real para Dia de Apresentações</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full sm:w-auto">

              <div className="flex items-center gap-2 bg-[#f0f6ff] p-1 rounded-xl border border-blue-100 w-full sm:w-auto">
              <button
                onClick={() => {
                  setRole('presenter');
                  window.history.replaceState({}, '', window.location.pathname);
                }}
                className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 py-1.5 px-4 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  role === 'presenter' 
                    ? 'bg-[#0066ff] text-white shadow-sm' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Laptop className="w-3.5 h-3.5" />
                Projetor (Professor)
              </button>
              <button
                onClick={() => {
                  setRole('student');
                  window.history.replaceState({}, '', `?mode=apresentacao_aluno`);
                }}
                className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 py-1.5 px-4 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  role === 'student' 
                    ? 'bg-[#0066ff] text-white shadow-sm' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                Celular (Participante)
              </button>
            </div>
          </div>
        </div>
      </header>
      )}

      {/* POPUP NOTIFICATION (ON TEACHER SCREEN) */}
      {activeNotification && role === 'presenter' && (
        <div className="fixed top-20 right-6 z-50 bg-[#091e3a] text-white p-4 rounded-2xl shadow-2xl border border-blue-500/30 flex items-center gap-3 animate-bounce max-w-sm">
          <span className="text-xl">✨</span>
          <p className="text-xs font-bold leading-tight">{activeNotification}</p>
        </div>
      )}

      {/* RENDER CASE A: PRESENTER (PROJECTOR) SCREEN */}
      {role === 'presenter' && (
        <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-6 grid grid-cols-1 lg:grid-cols-5 gap-6">
          
          {/* LEFT CARDS: STEP 1 (SIGNUP QR) & STEP 2 (ATTENDANCE DYNAMIC QR) */}
          <div className="col-span-1 lg:col-span-2 space-y-6">
            
            {/* QR 1: ENROLLMENT PORTAL */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm relative overflow-hidden flex flex-col items-center text-center space-y-4">
              <div className="absolute top-0 left-0 bg-[#0066ff] text-white px-3 py-1 rounded-br-xl text-[9px] font-bold tracking-wider uppercase">
                Passo 1: Entrar no App
              </div>
              
              <div className="pt-2">
                <h4 className="text-xs font-black text-slate-800">Crie seu Perfil pelo Celular</h4>
                <p className="text-[10px] text-slate-500">Escaneie para informar seu nome, curso e período</p>
              </div>

              <div className="bg-[#f8f9ff] p-3.5 rounded-2xl border border-slate-150 shadow-inner flex flex-col items-center w-full max-w-[200px]">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(getStudentShareUrl())}`}
                  alt="QR Code de Cadastro"
                  className="w-36 h-36 border border-slate-200 p-1 bg-white rounded-lg select-all transition-transform hover:scale-[1.02]"
                  referrerPolicy="no-referrer"
                />
                <button
                  type="button"
                  onClick={() => setExpandedQr('enrollment')}
                  className="mt-2 text-[10px] text-[#0066ff] hover:text-[#0054d6] font-bold flex items-center justify-center gap-1.5 cursor-pointer bg-blue-50/50 hover:bg-blue-50 py-1.5 px-3.5 rounded-lg border border-blue-100 transition-colors w-full"
                >
                  <Maximize2 className="w-3.5 h-3.5 text-[#0066ff]" />
                  <span>Ampliar QR Code</span>
                </button>
              </div>

              <div className="w-full space-y-2">
                <div className="flex bg-[#f1f5f9] border border-slate-200 rounded-lg p-2 items-center justify-between">
                  <span className="text-[9px] text-slate-600 truncate font-mono select-all text-left flex-1 pl-1">
                    {getStudentShareUrl()}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="bg-[#0066ff] hover:bg-blue-700 text-white font-extrabold text-[9px] px-2.5 py-1 rounded-md transition-colors cursor-pointer flex items-center gap-1 shrink-0"
                  >
                    <Clipboard className="w-2.5 h-2.5" />
                    {copiedLink ? 'Copiado!' : 'Copiar'}
                  </button>
                </div>
              </div>
            </div>

            {/* QR 2: DYNAMIC ATTENDANCE TOKEN */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm relative overflow-hidden flex flex-col items-center text-center space-y-4">
              <div className="absolute top-0 left-0 bg-[#10b981] text-white px-3 py-1 rounded-br-xl text-[9px] font-bold tracking-wider uppercase">
                Passo 2: Registro Dinâmico
              </div>

              <div className="pt-2">
                <h4 className="text-xs font-black text-slate-800">Token Rotativo de Presença</h4>
                <p className="text-[10px] text-slate-500">Este QR Code muda automaticamente de 10 em 10 segundos!</p>
              </div>

              <div className="flex flex-col items-center relative w-full max-w-[200px]">
                {/* Visual token display inside scanner wrapper */}
                <div className="bg-[#f0fdf4] p-3.5 rounded-2xl border-2 border-[#10b981]/50 shadow-inner flex flex-col items-center w-full">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(activeToken)}`}
                    alt="Token Chamada"
                    className="w-36 h-36 border border-slate-200 p-1.5 bg-white rounded-lg select-none transition-transform hover:scale-[1.02]"
                    referrerPolicy="no-referrer"
                  />
                  
                  {/* Rotating code representation */}
                  <div className="mt-2 bg-[#10b981] text-white px-5 py-1.5 rounded-xl font-mono text-base font-black tracking-widest flex items-center gap-2 select-all shadow-md">
                    <span>{activeToken}</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setExpandedQr('token')}
                    className="mt-2 text-[10px] text-[#10b981] hover:text-[#0b7d55] font-bold flex items-center justify-center gap-1.5 cursor-pointer bg-emerald-50/50 hover:bg-emerald-50 py-1.5 px-3.5 rounded-lg border border-emerald-100 transition-colors w-full"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                    <span>Ampliar QR Code 2</span>
                  </button>
                </div>

                {/* Circular timer indicator */}
                <div className="absolute -top-3 -right-3 bg-white w-10 h-10 rounded-full shadow-md border border-slate-100 flex items-center justify-center">
                  <svg className="w-8 h-8 transform -rotate-95">
                    <circle
                      cx="16"
                      cy="16"
                      r="12"
                      className="text-slate-100"
                      strokeWidth="2.5"
                      fill="transparent"
                      stroke="currentColor"
                    />
                    <circle
                      cx="16"
                      cy="16"
                      r="12"
                      className="text-[#10b981] transition-all duration-100 ease-linear"
                      strokeWidth="2.5"
                      fill="transparent"
                      stroke="currentColor"
                      strokeDasharray="75.3"
                      strokeDashoffset={(timeLeftMs / 10000) * 75.3}
                    />
                  </svg>
                  <span className="absolute text-[10px] font-black text-slate-700 select-none">
                    {Math.ceil(timeLeftMs / 1000)}
                  </span>
                </div>
              </div>

              <div className="w-full text-[10px] flex items-center justify-center gap-1.5 leading-tight text-slate-500 font-semibold bg-[#fcfdfd] border border-slate-150 p-2.5 rounded-xl">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                <span>Alunos devem apontar a câmera do Passo 2 para este código!</span>
              </div>
            </div>

          </div>

          {/* MAIN PROJECTION CENTER: SLIDES & LIVE SHEET LIST */}
          <div className="col-span-1 lg:col-span-3 space-y-6">
            
            {/* CURRENT PROJECTION SLIDE SCREEN */}
            <div className="bg-[#0b132b] rounded-3xl p-5 border border-slate-800 shadow-xl relative overflow-hidden flex flex-col space-y-4">
              
              {/* SLIDE COVER FRAME */}
              <div className="relative rounded-2xl overflow-hidden aspect-[16/9] bg-slate-900 border border-slate-800 flex items-center justify-center group shadow-inner">
                {slides[activeSlideIndex] ? (
                  <>
                    <img 
                      src={slides[activeSlideIndex].imageUrl} 
                      alt="Projeção" 
                      className="absolute inset-0 w-full h-full object-cover opacity-65 select-none"
                    />
                    
                    {/* Shadow overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent"></div>

                    {/* Left & Right toggle controls */}
                    <div className="absolute inset-0 flex items-center justify-between px-4 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => changeActiveSlide(Math.max(0, activeSlideIndex - 1))}
                        disabled={activeSlideIndex === 0}
                        className="w-10 h-10 rounded-full bg-slate-900/85 hover:bg-slate-900 text-white flex items-center justify-center border border-slate-700 disabled:opacity-40 transition-all cursor-pointer"
                      >
                        ◀
                      </button>
                      <button
                        onClick={() => changeActiveSlide(Math.min(slides.length - 1, activeSlideIndex + 1))}
                        disabled={activeSlideIndex === slides.length - 1}
                        className="w-10 h-10 rounded-full bg-slate-900/85 hover:bg-slate-900 text-white flex items-center justify-center border border-slate-700 disabled:opacity-40 transition-all cursor-pointer"
                      >
                        ▶
                      </button>
                    </div>

                    {/* Title Banner */}
                    <div className="absolute bottom-6 left-6 right-6 text-left">
                      <span className="text-[10px] text-indigo-400 font-extrabold uppercase tracking-widest block mb-1">
                        Slide {activeSlideIndex + 1} de {slides.length}
                      </span>
                      <h2 className="text-base sm:text-lg font-black text-white leading-tight drop-shadow-md">
                        {slides[activeSlideIndex].title}
                      </h2>
                    </div>
                  </>
                ) : (
                  <div className="text-slate-500 text-xs">Nenhum slide disponível</div>
                )}
              </div>

              {/* SLIDES BAR SELECTION SYSTEM */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-slate-800">
                {slides.map((slide, idx) => (
                  <button
                    key={slide.id}
                    onClick={() => changeActiveSlide(idx)}
                    className={`relative shrink-0 w-24 h-14 rounded-xl overflow-hidden border-2 transition-all cursor-pointer ${
                      idx === activeSlideIndex 
                        ? 'border-[#0066ff] scale-95 shadow-md shadow-blue-500/10' 
                        : 'border-slate-800 opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img src={slide.imageUrl} alt="" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <span className="text-[10px] font-black text-white bg-slate-950/80 rounded-md px-1.5 py-0.5">#{idx + 1}</span>
                    </div>
                  </button>
                ))}
                
                {/* Plus button to add custom slide */}
                <button
                  type="button"
                  onClick={() => {
                    const title = prompt("Digite o título do seu slide:");
                    const url = prompt("Cole a URL de uma imagem para o slide (via Unsplash ou similar):", "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=1000&auto=format&fit=crop&q=80");
                    if (title && url) {
                      addSlide(title, url);
                    }
                  }}
                  className="shrink-0 w-12 h-14 bg-slate-900 border-2 border-dashed border-slate-805 hover:bg-slate-850 text-indigo-400 rounded-xl flex items-center justify-center cursor-pointer transition-all hover:scale-105"
                  title="Criar novo slide"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {/* SLIDE CONTROL ACTIONS */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                <div className="flex gap-1">
                  {slides.length > 1 && (
                    <button
                      type="button"
                      onClick={() => deleteSlide(slides[activeSlideIndex].id)}
                      className="text-[9px] font-bold text-red-400 hover:text-red-300 py-1 px-2.5 rounded-lg border border-red-950 bg-red-950/15 cursor-pointer max-w-[130px] flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3 text-red-450" />
                      <span>Excluir slide atual</span>
                    </button>
                  )}
                </div>

                <div className="text-[9px] bg-slate-950/50 text-slate-400 px-3 py-1 rounded-lg border border-slate-805 font-mono">
                  Sincronização: {isServerOffline ? 'NUVEM CLOUD_SYN fallback' : 'WEBSOCKET_EXPRESS_LIVE'}
                </div>
              </div>
            </div>

            {/* LIVE SPREADSHEET SHEET OF COMPLETED DISPOSITIVES */}
            <div className="bg-white rounded-3xl border border-slate-200/85 p-6 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-black text-[#0b1c30] flex items-center gap-2">
                    <TableProperties className="w-4.5 h-4.5 text-[#0066ff]" />
                    Fila de Presença Integrada Live
                  </h3>
                  <p className="text-[10px] text-slate-500">Exibição em tempo real de quem teve o token validado</p>
                </div>

                <div className="flex items-center gap-2.5 self-end sm:self-auto w-full sm:w-auto">
                  {/* Generate Random Dummy Student */}
                  <button
                    type="button"
                    onClick={handleAddDemoStudent}
                    className="flex-1 sm:flex-none text-[10px] bg-slate-50 hover:bg-slate-100 font-extrabold text-[#0066ff] py-1.5 px-3 rounded-lg border border-blue-100 transition-all cursor-pointer"
                  >
                    + Simular Entrada
                  </button>
                  
                  {/* Download Spreadsheet Button */}
                  <button
                    type="button"
                    onClick={handleDownloadCSV}
                    className="flex-1 sm:flex-none text-[10px] bg-[#10b981] hover:bg-emerald-600 text-white font-extrabold py-1.5 px-3 rounded-lg shadow-sm transition-all cursor-pointer flex items-center justify-center gap-1 hover:shadow-inner"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Baixar Planilha</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleResetData}
                    className="p-1 px-2.5 rounded-lg bg-pink-50 hover:bg-pink-100 text-pink-700 border border-pink-150 transition-colors cursor-pointer text-[10px]"
                    title="Limpar todos os dados"
                  >
                    Limpar
                  </button>
                </div>
              </div>

              {/* SHEETS CONTAINER GRID */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-inner max-h-[380px] overflow-y-auto">
                {attendances.length === 0 ? (
                  <div className="p-12 text-center flex flex-col items-center justify-center bg-slate-50/50">
                    <div className="w-12 h-12 rounded-full border-2 border-dashed border-indigo-200 text-indigo-400 flex items-center justify-center mb-3 animate-spin">
                      ⏳
                    </div>
                    <span className="text-xs font-black text-[#0b1c30]">Aguardando participações escanearem</span>
                    <p className="text-[10px] text-slate-400 max-w-[280px] leading-relaxed mt-1">
                      Peça para os alunos apontarem para o <strong className="text-blue-500">QR Code 2</strong> rotativo acima após inserirem o nome completo!
                    </p>
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse bg-[#fcfdfd]">
                    <thead>
                      <tr className="bg-[#f0f6ff]/75 border-b border-indigo-150 text-[10px] font-black text-slate-650 tracking-wider uppercase">
                        <th className="py-2.5 px-4">#</th>
                        <th className="py-2.5 px-4">Estudante</th>
                        <th className="py-2.5 px-4">Informações de Curso</th>
                        <th className="py-2.5 px-4 text-center">Horário</th>
                        <th className="py-2.5 px-4 text-center">Validação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {attendances.map((item, index) => {
                        const hour = new Date(item.scannedAt).toLocaleTimeString('pt-BR');
                        return (
                          <tr key={item.id} className="hover:bg-[#f6faff]/70 transition-colors text-xs font-medium">
                            <td className="py-2 px-4 font-mono text-slate-400 select-none">
                              {attendances.length - index}
                            </td>
                            <td className="py-2 px-4">
                              <span className="font-extrabold text-[#0b1c30]">{item.studentName}</span>
                            </td>
                            <td className="py-2 px-4 leading-tight">
                              <p className="text-[11px] font-bold text-slate-600 truncate max-w-[200px]">{item.course}</p>
                              <span className="text-[9px] text-slate-400 block">{item.semester}</span>
                            </td>
                            <td className="py-2 px-4 text-center font-mono opacity-85 text-[10px]">
                              {hour}
                            </td>
                            <td className="py-2 px-4 text-center">
                              <span className="inline-flex items-center gap-1 bg-[#10b981]/10 text-[#059669] text-[9px] font-black py-0.5 px-2 rounded-full border border-emerald-200 uppercase tracking-wide">
                                <CheckCircle className="w-2.5 h-2.5" />
                                {item.tokenUsed}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              {/* SHEET BOTTOM METADATA BAR */}
              <div className="flex items-center justify-between text-[9px] text-slate-400 font-bold bg-[#fcfdfd] border border-slate-150 p-2.5 rounded-xl">
                <span>Registrados Totais: {students.length} dispositivo(s)</span>
                <span>Inscritos Confirmados: {attendances.length} aprovado(s)</span>
              </div>
            </div>

          </div>

        </main>
      )}

      {/* RENDER CASE B: STUDENT (PHONE) PORTAL */}
      {role === 'student' && (
        <main className="flex-grow max-w-md mx-auto w-full p-4 flex flex-col justify-center">
          
          {/* STATE B1: UNREGISTERED STUDENT (MUST SIGN UP FIRST) */}
          {!currentStudent ? (
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xl p-6 space-y-6">
              
              <div className="text-center space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-[#0066ff] flex items-center justify-center mx-auto shadow-inner">
                  <BookOpen className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-black text-[#0b1c30]">Participante OnClass</h3>
                <p className="text-xs text-slate-500 max-w-xs mx-auto">
                  Crie uma credencial provisória no seu dispositivo móvel para registrar sua presença pelo celular.
                </p>
              </div>

              <form onSubmit={handleEnrollStudent} className="space-y-4">
                <div>
                  <label className="text-[10px] text-slate-700 font-black uppercase tracking-wider block mb-1">Seu Nome Completo</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Ana Maria Couto"
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    className="w-full bg-[#f8f9ff] border border-slate-200 rounded-xl px-4 py-3 text-xs outline-none focus:bg-white focus:border-[#0066ff] focus:ring-1 focus:ring-[#0066ff] font-semibold text-slate-700"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-slate-700 font-black uppercase tracking-wider block mb-1">Seu Curso</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Engenharia de Software"
                    value={studentCourse}
                    onChange={(e) => setStudentCourse(e.target.value)}
                    className="w-full bg-[#f8f9ff] border border-slate-200 rounded-xl px-4 py-3 text-xs outline-none focus:bg-white focus:border-[#0066ff] focus:ring-1 focus:ring-[#0066ff] font-semibold text-slate-700"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-slate-700 font-black uppercase tracking-wider block mb-1">Seu Período de Semestre</label>
                  <select
                    value={studentSemester}
                    onChange={(e) => setStudentSemester(e.target.value)}
                    className="w-full bg-[#f8f9ff] border border-slate-200 rounded-xl px-3 py-3 text-xs outline-none focus:bg-white focus:border-[#0066ff] focus:ring-1 focus:ring-[#0066ff] font-semibold text-slate-500"
                  >
                    <option value="1º Semestre">1º Semestre / Introdução</option>
                    <option value="2º Semestre">2º Semestre</option>
                    <option value="3º Semestre">3º Semestre / Intermediário</option>
                    <option value="4º Semestre">4º Semestre</option>
                    <option value="5º Semestre">5º Semestre / Tecnologia</option>
                    <option value="6º Semestre">6º Semestre</option>
                    <option value="7º Semestre">7º Semestre / TCC I</option>
                    <option value="8º Semestre">8º Semestre / Conclusão</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-[#0066ff] hover:bg-blue-700 text-white font-black text-xs py-3 rounded-xl shadow-md shadow-indigo-100 transition-colors cursor-pointer"
                >
                  {isLoading ? 'Registrando...' : 'Criar Perfil de Aluno'}
                </button>
              </form>

              <div className="bg-blue-50/50 p-3 rounded-xl border border-blue-100/50 text-[10px] text-blue-700 leading-tight">
                💡 <strong>Por que fazer isso?</strong> Após preencher isso uma vez, seu aparelho é vinculado ao painel. Próximos slides se atualizam sincronizados!
              </div>

            </div>
          ) : hasAlreadyCheckedIn || scanStatus.type === 'success' ? (
            
            /* STATE B2: SUCCESSFULLY CHECKED IN PORTAL */
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xl p-6 text-center space-y-6">
              
              <div className="relative flex justify-center py-4">
                {/* Bear congratulating */}
                <div className="w-36 h-36 border border-slate-200 p-1 bg-gradient-to-tr from-rose-100 to-amber-100 rounded-full flex items-center justify-center animate-bounce">
                  <svg viewBox="0 0 140 140" className="w-28 h-28">
                    <g className="translate-y-4">
                      {/* Ears */}
                      <circle cx="34" cy="42" r="15" fill="#92400e" />
                      <circle cx="34" cy="42" r="8" fill="#fecdd3" />

                      <circle cx="106" cy="42" r="15" fill="#92400e" />
                      <circle cx="106" cy="42" r="8" fill="#fecdd3" />

                      <ellipse cx="70" cy="65" rx="38" ry="32" fill="#d97706" />

                      <circle cx="55" cy="58" r="5" fill="#1e1b4b" />
                      <circle cx="53.5" cy="55.5" r="2.2" fill="#ffffff" />
                      
                      <circle cx="85" cy="58" r="5" fill="#1e1b4b" />
                      <circle cx="83.5" cy="55.5" r="2.2" fill="#ffffff" />

                      <circle cx="44" cy="68" r="5.5" fill="#f43f5e" fillOpacity="0.55" />
                      <circle cx="96" cy="68" r="5.5" fill="#f43f5e" fillOpacity="0.55" />

                      <ellipse cx="70" cy="74" rx="14" ry="10" fill="#fcd34d" />
                      <path d="M 65 71 Q 70 76 75 71 Z" fill="#1e1b4b" />
                      <path d="M 64 77 Q 70 82 76 77" fill="none" stroke="#1e1b4b" strokeWidth="2" strokeLinecap="round" />
                    </g>
                  </svg>
                </div>
              </div>

              <div className="space-y-1 badge-pulse">
                <span className="px-3.5 py-1 bg-emerald-100 text-emerald-800 text-[10px] font-black rounded-full uppercase tracking-wider">
                  Presença Registrada!
                </span>
                <h3 className="text-2xl font-black text-[#10b981] uppercase tracking-tight pt-1">
                  Presença Confirmada!
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed max-w-xs mx-auto">
                  Seus dados foram sincronizados ao vivo e o urso está comemorando por você! 🐻🎉
                </p>
              </div>

              <div className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100 text-left space-y-2 font-medium">
                <div>
                  <span className="text-[9px] text-slate-400 block font-bold uppercase tracking-wider">Participante</span>
                  <p className="text-xs font-bold text-[#0b1c30]">{currentStudent.name}</p>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                  <div>
                    <span className="text-[9px] text-slate-400 block font-bold uppercase tracking-wider">Curso</span>
                    <p className="text-[11px] font-bold text-slate-700 truncate">{currentStudent.course}</p>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-400 block font-bold uppercase tracking-wider">Semestre</span>
                    <p className="text-[11px] font-bold text-slate-700">{currentStudent.semester}</p>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100">
                <div className="p-3 bg-blue-50/50 rounded-2xl border border-blue-100 font-bold text-[#0066ff] text-[10px] text-center select-none uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-inner">
                  <span>🔒 Registro Único Consolidado por Dispositivo</span>
                </div>
              </div>

              <div className="text-[9px] text-slate-400 flex items-center justify-center gap-1.5 font-medium">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></span>
                <span>Conexão ativa e sincronizada em tempo real</span>
              </div>
            </div>
          ) : (
            
            /* STEP 2: ACTIVE SCANNER SIMULATION PORTAL */
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-lg p-6 space-y-6">
              
              {/* STUDENT BADGE INTRO */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-blue-100 text-[#0066ff] font-black text-[11px] flex items-center justify-center">
                    {currentStudent.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="text-xs font-extrabold text-slate-800">{currentStudent.name}</h4>
                    <span className="text-[10px] text-slate-400 block font-medium">{currentStudent.course} • {currentStudent.semester}</span>
                  </div>
                </div>

                <div className="text-[9px] bg-slate-50 text-slate-500 px-2 py-1 rounded-md font-bold uppercase tracking-wider border border-slate-200/60 shadow-inner flex items-center gap-1 select-none shrink-0">
                  <span>🔒 Identidade Fixada</span>
                </div>
              </div>

              {/* REAL CAMERA SCANNER */}
              <div className="relative rounded-2xl bg-[#070b13] overflow-hidden min-h-[220px] flex flex-col items-center justify-center text-center text-white border-2 border-slate-800">
                {/* HTML5 QR Code element target */}
                <div id="qr-reader-container" className="w-full h-full min-h-[200px]" />

                {/* Overlay while loading / starting camera */}
                {!isCameraActive && !cameraPermissionError && (
                  <div className="absolute inset-0 bg-slate-900 flex flex-col items-center justify-center p-4">
                    <RefreshCw className="w-8 h-8 text-[#0066ff] animate-spin mb-2" />
                    <h5 className="text-xs font-bold">Iniciando Scanner de Câmera...</h5>
                  </div>
                )}

                {/* Permission or start error state */}
                {cameraPermissionError && (
                  <div className="absolute inset-0 bg-[#0f1422] flex flex-col items-center justify-center p-4 text-center">
                    <Camera className="w-8 h-8 text-red-500 mb-2" />
                    <h5 className="text-xs font-bold text-red-400">Scanner de Câmera Indisponível</h5>
                    <p className="text-[10px] text-slate-400 mt-1.5 max-w-[250px] leading-tight">
                      {cameraPermissionError}
                    </p>
                  </div>
                )}

                {/* Laser scan animation when camera is running */}
                {isCameraActive && (
                  <>
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0066ff]/5 to-transparent select-none pointer-events-none"></div>
                    <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-[#0066ff] shadow-md shadow-blue-500/50 animate-bounce select-none pointer-events-none"></div>
                    
                    {/* Corners structure */}
                    <div className="absolute top-4 left-4 w-4 h-4 border-t-2 border-l-2 border-[#0066ff] rounded-tl-sm pointer-events-none"></div>
                    <div className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2 border-[#0066ff] rounded-tr-sm pointer-events-none"></div>
                    <div className="absolute bottom-4 left-4 w-4 h-4 border-b-2 border-l-2 border-[#0066ff] rounded-bl-sm pointer-events-none"></div>
                    <div className="absolute bottom-4 right-4 w-4 h-4 border-b-2 border-r-2 border-[#0066ff] rounded-br-sm pointer-events-none"></div>
                  </>
                )}
              </div>

              {/* NOTIFICATION BARS */}
              {scanStatus.type === 'error' && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-900 rounded-xl text-xs leading-relaxed font-semibold">
                  <span>{scanStatus.message}</span>
                </div>
              )}

              {/* FALLBACK INPUT MANUAL FORM */}
              <div className="border-t border-slate-100 pt-5 space-y-3">
                <div className="text-center">
                  <h5 className="text-[10px] text-slate-700 font-black uppercase tracking-wider">Não conseguiu escanear?</h5>
                  <p className="text-[9px] text-slate-400">Insira a chave de 4 letras mudando a cada 10s no telão:</p>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    maxLength={10}
                    placeholder="LIVE-XXXX"
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                    className="flex-1 bg-slate-50 border border-slate-200 text-center font-mono text-sm font-black tracking-widest text-[#0b1c30] rounded-xl px-3 outline-none uppercase focus:bg-white focus:border-[#0066ff] focus:ring-1 focus:ring-[#0066ff]"
                  />
                  <button
                    onClick={() => handleScanOrSubmitCode(manualCode)}
                    disabled={isLoading}
                    className="bg-[#0066ff] hover:bg-blue-700 text-white font-bold text-xs px-5 py-3 rounded-xl cursor-pointer shadow-sm shadow-blue-100 transition-colors shrink-0"
                  >
                    Registrar
                  </button>
                </div>
              </div>

              <div className="text-center">
                <span className="text-[9px] text-slate-400 block font-medium">As presenças caem na hora no telão do projetor!</span>
              </div>

            </div>
          )}

        </main>
      )}

      {/* FULLSCREEN COLOSSAL QR CODE EXPANSION MODAL */}
      {expandedQr && (
        <div 
          onClick={() => setExpandedQr(null)}
          className="fixed inset-0 z-55 bg-slate-950/98 backdrop-blur-md flex flex-col items-center justify-center p-4 select-none animate-fade-in cursor-zoom-out"
        >
          {/* Main Modal body card */}
          <div 
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl bg-[#091122] border border-slate-800 rounded-[32px] p-6 sm:p-10 flex flex-col items-center relative text-center shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)] space-y-6 cursor-default"
          >
            {/* Close button */}
            <button
              onClick={() => setExpandedQr(null)}
              className="absolute top-5 right-5 w-10 h-10 rounded-full bg-white/15 hover:bg-white/20 text-white flex items-center justify-center transition-colors border border-white/10 cursor-pointer shadow-md"
              title="Fechar"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Title & Step Header */}
            <div className="space-y-2">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 text-[11px] font-extrabold uppercase tracking-widest rounded-full ${expandedQr === 'enrollment' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'}`}>
                <span className="w-2 h-2 rounded-full bg-current animate-pulse"></span>
                {expandedQr === 'enrollment' ? 'Passo 1: Criar Registro' : 'Passo 2: Validar Presença'}
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-none mt-2">
                {expandedQr === 'enrollment' ? 'Escaneie para se Cadastrar' : 'Escaneie para Registrar Presença'}
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto leading-relaxed font-semibold">
                {expandedQr === 'enrollment' 
                  ? 'Aponte a câmera do celular para o código abaixo. Insira seu nome completo e curso para começar!' 
                  : 'Este código é temporário e rotativo. Aponte a câmera do celular ou digite o código de 4 letras abaixo!'
                }
              </p>
            </div>

            {/* Beautiful QR Code Board Container with clean margins */}
            <div className="p-6 bg-white rounded-[24px] shadow-[0_20px_50px_rgba(0,0,0,0.4)] flex items-center justify-center border border-slate-100 transition-transform duration-300 hover:scale-[1.01]">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=380x380&data=${encodeURIComponent(expandedQr === 'enrollment' ? getStudentShareUrl() : activeToken)}`}
                alt="Colossal QR Code"
                className="w-64 h-64 sm:w-80 sm:h-80 select-none bg-white p-1 rounded-lg"
                referrerPolicy="no-referrer"
              />
            </div>

            {/* Accessory displays (Clock Timer & Token Code) */}
            {expandedQr === 'token' ? (
              <div className="flex flex-col sm:flex-row items-center gap-4 w-full justify-center">
                <div className="bg-[#10b981] hover:bg-[#059669] transition-colors text-white px-8 py-3.5 rounded-2xl font-mono text-2xl sm:text-3xl font-black tracking-widest shadow-lg leading-none border border-emerald-400/30">
                  {activeToken}
                </div>
                
                {/* Timer inside modal */}
                <div className="bg-white/5 border border-white/10 px-5 py-3 rounded-2xl flex items-center gap-3">
                  <span className="text-xs font-semibold text-slate-350">Código Expira em:</span>
                  <div className="bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-xl font-mono text-base font-black">
                    {Math.ceil(timeLeftMs / 1000)}s
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white/5 border border-white/10 px-6 py-2.5 rounded-2xl text-[11px] font-semibold text-slate-300 max-w-sm sm:max-w-md truncate">
                Link Manual: <span className="text-blue-450 font-mono select-all ml-1 underline">{getStudentShareUrl()}</span>
              </div>
            )}

            {/* Footer close helper */}
            <div className="pt-2 w-full">
              <button
                onClick={() => setExpandedQr(null)}
                className="w-full sm:w-auto px-8 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-black tracking-wider uppercase transition-all duration-250 cursor-pointer border border-white/10 shadow-md"
              >
                Voltar ao Painel ✕
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
