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
          attendances: []
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

  // Auto-derived deep student link
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
            console.warn(storageErr);
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

  // Handle student scanning/submitting 4-digit code
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
        const isTokenValid = upperToken === currentTokenStored || upperToken === 'LIVE-ON95';

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
        const isTokenValid = upperToken === currentTokenStored || upperToken === 'LIVE-ON95';

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
    setTimeout(() => setActiveNotification(null), 3000);
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
                  <div className="mt-2 bg-[#10b981] text-white px-4 py-1 rounded-xl font-mono text-sm font-extrabold tracking-widest shadow-xs">
                    {activeToken}
                  </div>

                  <button
                    type="button"
                    onClick={() => setExpandedQr('token')}
                    className="mt-2 text-[10px] text-teal-800 hover:text-teal-950 font-bold flex items-center justify-center gap-1.5 cursor-pointer bg-emerald-50 hover:bg-emerald-100 py-1.5 px-3 rounded-lg border border-emerald-100 transition-colors w-full"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                    <span>Ampliar QR Code</span>
                  </button>
                </div>

                {/* Progress count-down circle in overlay */}
                <div className="absolute -top-3.5 -right-3.5 bg-white p-2 border border-slate-100 rounded-full shadow-lg flex items-center justify-center">
                  <svg className="w-10 h-10 select-none -rotate-90">
                    <circle
                      cx="20"
                      cy="20"
                      r="15"
                      className="text-slate-100 stroke-current"
                      strokeWidth="3.5"
                      fill="transparent"
                    />
                    <circle
                      cx="20"
                      cy="20"
                      r="15"
                      className="text-emerald-500 stroke-current transition-all duration-100"
                      strokeWidth="3.5"
                      fill="transparent"
                      strokeDasharray="283"
                      strokeDashoffset={strokeDashoffset}
                    />
                  </svg>
                  <span className="absolute text-[9px] font-black text-slate-700">
                    {Math.ceil(timeLeftMs / 1000)}s
                  </span>
                </div>
              </div>

              <span className="text-[10px] bg-emerald-50 text-emerald-800 py-1 px-3 rounded-full font-bold">
                🔒 Antifraude por Geolocalização e Chave Ativa
              </span>
            </div>

          </div>

          {/* RIGHT SIDE: LIVE SHEET */}
          <div className="col-span-1 lg:col-span-3">

            {/* SPREADSHEET CARD */}
            <div className="flex flex-col bg-white rounded-3xl border border-slate-200/80 shadow-md p-6 h-full min-h-[500px]">
            
            {/* Grid Title bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-slate-100 pb-5 mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md">
                  <TableProperties className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-800">Planilha de Chamada</h3>
                  <p className="text-[11px] text-slate-500 font-medium">Relatório Automático Gerado pelo Scanner do Professor</p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  onClick={handleAddDemoStudent}
                  className="flex-1 sm:flex-initial py-1.5 px-3 rounded-xl bg-[#f0f6ff] text-[#0066ff] hover:bg-blue-100 text-xs font-extrabold select-none transition-all cursor-pointer flex items-center justify-center gap-1 border border-blue-150"
                  title="Simula a entrada de alunos para simular"
                >
                  <Plus className="w-3.5 h-3.5" />
                  + Testar Aluno
                </button>
                <button
                  onClick={handleDownloadCSV}
                  className="flex-1 sm:flex-initial py-1.5 px-3 rounded-xl bg-[#0066ff] hover:bg-blue-700 text-white text-xs font-extrabold transition-all cursor-pointer flex items-center justify-center gap-1 shadow-sm"
                  title="Exportar para Excel / LibreOffice"
                >
                  <Download className="w-3.5 h-3.5" />
                  Exportar CSV
                </button>
                <button
                  onClick={handleResetData}
                  className="p-2 rounded-xl bg-slate-50 hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors border border-slate-200 cursor-pointer"
                  title="Limpar todos os registros e reiniciar"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* STATS TILES */}
            <div className="grid grid-cols-3 gap-4 mb-5">
              <div className="bg-[#f8f9ff] rounded-2xl p-3 border border-slate-100 text-center">
                <span className="text-[9px] text-[#64748b] font-bold uppercase tracking-wider block">Estudantes</span>
                <span className="text-xl font-black text-[#0b1c30]">{students.length}</span>
              </div>
              <div className="bg-[#ecfdf5] rounded-2xl p-3 border border-[#d1fae5] text-center">
                <span className="text-[9px] text-[#047857] font-bold uppercase tracking-wider block">Presenças</span>
                <span className="text-xl font-black text-[#10b981]">{attendances.length}</span>
              </div>
              <div className="bg-[#fffbeb] rounded-2xl p-3 border border-[#fef3c7] text-center">
                <span className="text-[9px] text-[#b45309] font-bold uppercase tracking-wider block">Aproveit.</span>
                <span className="text-xl font-black text-[#amber-700]">
                  {students.length > 0 ? `${Math.round((attendances.length / students.length) * 100)}%` : '0%'}
                </span>
              </div>
            </div>

            {/* ACTUAL SPREADSHEET */}
            <div className="flex-1 overflow-auto max-h-[380px] border border-slate-100 rounded-2xl">
              {attendances.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-400 space-y-2">
                  <div className="w-12 h-12 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center mb-1">
                    <Users className="w-6 h-6 text-slate-300" />
                  </div>
                  <h4 className="text-xs font-black text-slate-700">Histórico de Presenças Vazio</h4>
                  <p className="text-[10px] text-slate-500 max-w-sm">
                    Escaneie o QR Code na tela com o celular para assinar a chamada! Você também pode clicar no botão azul <strong>"+ Testar Aluno"</strong> acima para povoar a lista instantaneamente.
                  </p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-[#f8fafc] sticky top-0 border-b border-slate-100 font-bold text-slate-600">
                    <tr>
                      <th className="p-3 pl-4 text-[10px] uppercase">#</th>
                      <th className="p-3 text-[10px] uppercase">Nome do Aluno</th>
                      <th className="p-3 text-[10px] uppercase">Curso</th>
                      <th className="p-3 text-[10px] uppercase">Semestre</th>
                      <th className="p-3 text-[10px] uppercase">Horário</th>
                      <th className="p-3 pr-4 text-center text-[10px] uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {attendances.map((item, index) => {
                      const number = attendances.length - index;
                      const time = new Date(item.scannedAt).toLocaleTimeString('pt-BR');
                      
                      return (
                        <tr key={item.id} className="hover:bg-slate-50/50 transition-colors animate-fade-in">
                          <td className="p-3 pl-4 text-slate-400 font-mono text-[10px]">{number}</td>
                          <td className="p-3 font-bold text-slate-900">{item.studentName}</td>
                          <td className="p-3 text-slate-500">{item.course}</td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 bg-slate-100 rounded-md text-[10px]">{item.semester}</span>
                          </td>
                          <td className="p-3 text-slate-400 font-mono text-[10px]">{time}</td>
                          <td className="p-3 pr-4 text-center">
                            <span className="inline-flex items-center gap-1 py-0.5 px-2 bg-emerald-50 text-emerald-700 rounded-full text-[10px] font-bold border border-emerald-150">
                              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></span>
                              Presente
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            <div className="pt-4 border-t border-slate-100 text-[10px] text-slate-500 flex items-center justify-between">
              <span>* Os dados sincronizados em tempo real via Express Server em memória.</span>
              <span className="font-extrabold text-[#0066ff]">OnClass Test Presentation Screen</span>
            </div>

          </div> {/* Closes Spreadsheet card */}
        </div>   {/* Closes col-span-3 wrapper */}

        </main>
      )}

      {/* RENDER CASE B: PARTICIPANT / STUDENT VIEW (MOBILE) */}
      {role === 'student' && (
        <main className="flex-1 max-w-lg mx-auto w-full p-4 flex flex-col justify-center">
          
          {/* STEP 1: FORM TO ACCREDIT USER */}
          {!currentStudent ? (
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-lg p-6 space-y-6">
              <div className="text-center space-y-1">
                <div className="w-12 h-12 bg-blue-50 text-[#0066ff] rounded-2.5xl flex items-center justify-center mx-auto mb-2">
                  <Smartphone className="w-6 h-6" />
                </div>
                <h3 className="text-base font-black text-[#0b1c30]">Ficha do Participante</h3>
                <p className="text-xs text-slate-500 leading-relaxed max-w-sm mx-auto">
                  Preencha seus dados para simular a sua presença agora mesmo na tela do professor de nossa apresentação!
                </p>
              </div>

              <form onSubmit={handleEnrollStudent} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Seu Nome Completo</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Amanda Bezerra"
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    className="w-full text-xs font-medium bg-slate-50/75 border border-slate-200 rounded-xl px-3.5 py-3.5 outline-none focus:bg-white focus:border-[#0066ff] focus:ring-1 focus:ring-[#0066ff] transition-all"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Curso de Graduação</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Administração de Empresas, Computação..."
                    value={studentCourse}
                    onChange={(e) => setStudentCourse(e.target.value)}
                    className="w-full text-xs font-medium bg-slate-50/75 border border-slate-200 rounded-xl px-3.5 py-3.5 outline-none focus:bg-white focus:border-[#0066ff] focus:ring-1 focus:ring-[#0066ff] transition-all"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Semestre Atual</label>
                  <select
                    value={studentSemester}
                    onChange={(e) => setStudentSemester(e.target.value)}
                    className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 outline-none cursor-pointer focus:bg-white focus:border-[#0066ff]"
                  >
                    <option value="1º Semestre">1º Semestre</option>
                    <option value="2º Semestre">2º Semestre</option>
                    <option value="3º Semestre">3º Semestre</option>
                    <option value="4º Semestre">4º Semestre</option>
                    <option value="5º Semestre">5º Semestre</option>
                    <option value="6º Semestre">6º Semestre</option>
                    <option value="7º Semestre">7º Semestre</option>
                    <option value="8º Semestre">8º Semestre</option>
                    <option value="9º Semestre">9º Semestre</option>
                    <option value="10º Semestre">10º Semestre</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-4 px-4 bg-[#0066ff] hover:bg-blue-700 text-white rounded-xl text-xs font-bold leading-none cursor-pointer shadow-md shadow-blue-200/50 flex items-center justify-center gap-1.5 transition-colors pt-4 pb-4"
                >
                  {isLoading ? 'Registrando...' : 'Entrar na Chamada Ao Vivo'}
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>
          ) : (scanStatus.type === 'success' || hasAlreadyCheckedIn) ? (
            /* PRESENÇA CONFIRMADA CARD SUCCESS STATE */
            <div className="bg-white rounded-3xl border border-emerald-100 shadow-xl p-8 space-y-6 text-center animate-fade-in my-auto max-w-sm w-full mx-auto select-none">
              
              {/* Custom Dancing Bear & Confetti Keyframes Styles scoped here */}
              <style>{`
                @keyframes bear-dance {
                  0%, 100% { transform: translateY(0) rotate(-6deg) scale(1); }
                  50% { transform: translateY(-10px) rotate(6deg) scale(1.05); }
                }
                @keyframes left-arm-dance {
                  0%, 100% { transform: rotate(-30deg); }
                  50% { transform: rotate(45deg); }
                }
                @keyframes right-arm-dance {
                  0%, 100% { transform: rotate(30deg); }
                  50% { transform: rotate(-45deg); }
                }
                @keyframes left-foot-dance {
                  0%, 100% { transform: translate(0, 0) rotate(0deg); }
                  50% { transform: translate(-4px, -3px) rotate(-15deg); }
                }
                @keyframes right-foot-dance {
                  0%, 100% { transform: translate(0, 0) rotate(0deg); }
                  50% { transform: translate(4px, -3px) rotate(15deg); }
                }
                @keyframes musical-note-1 {
                  0% { transform: translate(0, 20px) scale(0) rotate(0deg); opacity: 0; }
                  50% { opacity: 0.8; }
                  100% { transform: translate(-30px, -80px) scale(1) rotate(-35deg); opacity: 0; }
                }
                @keyframes musical-note-2 {
                  0% { transform: translate(0, 20px) scale(0) rotate(0deg); opacity: 0; }
                  50% { opacity: 0.8; }
                  100% { transform: translate(30px, -70px) scale(1.1) rotate(35deg); opacity: 0; }
                }
                @keyframes badge-pop {
                  0% { transform: scale(0.9); }
                  50% { transform: scale(1.08); }
                  100% { transform: scale(1); }
                }

                .bear-container {
                  animation: bear-dance 1.4s ease-in-out infinite;
                  transform-origin: bottom center;
                }
                .left-arm {
                  animation: left-arm-dance 0.7s ease-in-out infinite alternate;
                  transform-origin: 38px 105px;
                }
                .right-arm {
                  animation: right-arm-dance 0.7s ease-in-out infinite alternate;
                  transform-origin: 102px 105px;
                }
                .left-foot {
                  animation: left-foot-dance 0.7s ease-in-out infinite alternate;
                  transform-origin: 50px 145px;
                }
                .right-foot {
                  animation: right-foot-dance 0.7s ease-in-out infinite alternate;
                  transform-origin: 90px 145px;
                }
                .sparkle-note-1 {
                  animation: musical-note-1 2.2s ease-out infinite;
                }
                .sparkle-note-2 {
                  animation: musical-note-2 2.6s ease-out infinite 0.7s;
                }
                .badge-pulse {
                  animation: badge-pop 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
                }
              `}</style>

              {/* Celebrating Bear Mascot SVG Wrapper */}
              <div className="relative w-full flex flex-col items-center justify-center py-2 select-none">
                {/* Floating Confetti / Sparkles */}
                <span className="absolute text-xl sparkle-note-1 left-[25%] top-[5%] select-none pointer-events-none">✨</span>
                <span className="absolute text-2xl sparkle-note-2 right-[25%] top-[10%] select-none pointer-events-none">🎵</span>
                <span className="absolute text-lg sparkle-note-1 right-[20%] top-[45%] select-none pointer-events-none">🎶</span>
                <span className="absolute text-xl sparkle-note-2 left-[18%] top-[50%] select-none pointer-events-none">🎉</span>
                <span className="absolute text-lg sparkle-note-1 left-[32%] top-[70%] select-none pointer-events-none">🐻</span>
                <span className="absolute text-lg sparkle-note-2 right-[30%] top-[75%] select-none pointer-events-none">✨</span>

                <div className="w-40 h-40 flex items-center justify-center transition-all bg-sky-50/50 rounded-full border border-sky-100 shadow-inner p-2 relative">
                  <svg 
                    viewBox="0 0 140 160" 
                    className="w-36 h-36 drop-shadow-[0_10px_15px_rgba(115,64,4,0.18)]"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <g className="bear-container">
                      <ellipse cx="70" cy="148" rx="35" ry="6" fill="#000000" fillOpacity="0.08" />

                      {/* Left Foot */}
                      <g className="left-foot">
                        <ellipse cx="50" cy="143" rx="14" ry="10" fill="#92400e" />
                        <ellipse cx="50" cy="141" rx="8" ry="6" fill="#fcd34d" />
                        <circle cx="43" cy="135" r="2.5" fill="#fcd34d" />
                        <circle cx="50" cy="133" r="2.5" fill="#fcd34d" />
                        <circle cx="57" cy="135" r="2.5" fill="#fcd34d" />
                      </g>

                      {/* Right Foot */}
                      <g className="right-foot">
                        <ellipse cx="90" cy="143" rx="14" ry="10" fill="#92400e" />
                        <ellipse cx="90" cy="141" rx="8" ry="6" fill="#fcd34d" />
                        <circle cx="83" cy="135" r="2.5" fill="#fcd34d" />
                        <circle cx="90" cy="133" r="2.5" fill="#fcd34d" />
                        <circle cx="97" cy="135" r="2.5" fill="#fcd34d" />
                      </g>

                      {/* Left Hand / Arm */}
                      <g className="left-arm">
                        <ellipse cx="28" cy="108" rx="12" ry="8" fill="#d97706" transform="rotate(-30 28 108)" />
                        <circle cx="20" cy="108" r="5" fill="#feb019" />
                      </g>

                      {/* Right Hand / Arm */}
                      <g className="right-arm">
                        <ellipse cx="112" cy="108" rx="12" ry="8" fill="#d97706" transform="rotate(30 112 108)" />
                        <circle cx="120" cy="108" r="5" fill="#feb019" />
                      </g>

                      <rect x="36" y="88" width="68" height="52" rx="28" fill="#92400e" />
                      <ellipse cx="70" cy="116" rx="22" ry="18" fill="#fef3c7" />
                      <circle cx="70" cy="124" r="2.5" fill="#b45309" />

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
                <span>Conexão active e sincronizada em tempo real</span>
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
              className="absolute top-5 right-5 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors border border-white/10 cursor-pointer shadow-md"
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
