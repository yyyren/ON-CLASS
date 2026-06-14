```tsx
import React, { useState, useEffect } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { 
  Users, 
  Download, 
  CheckCircle, 
  Plus, 
  Trash2, 
  ArrowLeft, 
  Camera, 
  Laptop, 
  TableProperties,
  Smartphone
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

  // Server state - Ajustado tempo inicial de expiração do código para 30 segundos (30000ms)
  const [activeToken, setActiveToken] = useState<string>(() => {
    return localStorage.getItem('onclass_pres_active_token') || 'LIVE-ON95';
  });

  const [timeLeftMs, setTimeLeftMs] = useState<number>(30000);
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
            let tokenValue = decodedText;
            try {
              // If student accidentally scanned QR 1 instead of QR 2, handle gracefully
              if (decodedText.includes("mode=apresentacao_aluno")) {
                const urlObj = new URL(decodedText);
                const roomParam = urlObj.searchParams.get("room");
                if (roomParam) {
                  alert(`Você escaneou o QR Code do Cadastro (Passo 1).\nPor favor, aponte para o QR Code de Validação (Passo 2) com o código de tempo atualizado!`);
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

  // Dynamic Room Code
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
          } else {
            // Initialize the room on public cloud store
            const freshState = {
              activeToken,
              students: [],
              attendances: [],
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

  // Synchronize dynamic Circle SVG timer count as milliseconds deplete - Ajustado reset para 30000ms
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeftMs((prev) => {
        if (prev <= 100) {
          if (isServerOffline && role === 'presenter') {
            // Generate a brand new token client-side with 30s rotation as fallback!
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
          return 30000; // Mantém a nova rotação em 30 segundos
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
      alert("Por favor, preencha o seu nome e curso.");
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
          students: [],
          attendances: []
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
          students: [],
          attendances: []
        };
        const currentTokenStored = cloudState.activeToken || 'LIVE-ON95';
        const previousTokenStored = cloudState.previousToken || localStorage.getItem('onclass_pres_previous_token') || '';
        const isTokenValid = upperToken === currentTokenStored || upperToken === previousTokenStored || upperToken === 'LIVE-ON95';
        if (!isTokenValid) {
          setScanStatus({ 
            type: 'error', 
            message: 'QR Code Expirado ou Código Inválido! Tente novamente com o código atualizado de 30s.' 
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
            message: 'QR Code Expirado ou Código Inválido! Tente novamente com o código atualizado de 30s.' 
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
          students: [],
          attendances: [],
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
                    role === 'presenter' ? 'bg-[#0066ff] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
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
                    role === 'student' ? 'bg-[#0066ff] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  Celular (Aluno)
                </button>
              </div>
            </div>
          </div>
        </header>
      )}

      {/* FLOATING SUCCESS POP NOTIFICATION (Presenter view only) */}
      {activeNotification && role === 'presenter' && (
        <div className="fixed top-24 right-6 z-50 bg-[#091e3a] text-white py-4 px-5 rounded-2xl shadow-2xl border border-blue-500/30 max-w-sm transition-all duration-300 animate-slide-in">
          <p className="text-xs font-bold tracking-wide">{activeNotification}</p>
        </div>
      )}

      {/* CORE DISPLAY */}
      {role === 'presenter' ? (
        <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-6 grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* LEFT SIDE: QR CODES AND ACCESS INSTRUCTIONS */}
          <div className="col-span-1 lg:col-span-2 flex flex-col gap-6">
            
            {/* PASSO 1: REGISTER PROFILE LINK */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-col items-center text-center space-y-4">
              <span className="bg-blue-100 text-[#0066ff] px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-wider">
                Passo 1: Entrar na Chamada
              </span>
              <p className="text-xs text-slate-500 max-w-xs font-medium leading-relaxed">
                Abra a câmera do celular e aponte para o QR Code abaixo para preencher os seus dados de identificação.
              </p>
              
              <div className="bg-white p-3 border border-slate-200 rounded-2xl shadow-sm transition-transform hover:scale-[1.02]">
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(getStudentShareUrl())}`} 
                  className="w-40 h-40 object-contain" 
                  alt="QR Cadastro"
                  referrerPolicy="no-referrer"
                />
              </div>

              <div className="w-full flex gap-1.5 bg-slate-50 p-2 rounded-xl items-center border border-slate-200/60">
                <span className="text-[10px] text-slate-500 font-mono truncate flex-1 text-left select-all pl-1.5">
                  {getStudentShareUrl()}
                </span>
                <button 
                  onClick={handleCopyLink}
                  className="bg-[#0066ff] text-white text-[10px] font-extrabold px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors cursor-pointer shrink-0"
                >
                  {copiedLink ? 'Copiado!' : 'Copiar'}
                </button>
              </div>
            </div>

            {/* PASSO 2: TIME-VALIDATION TOKEN */}
            <div className="bg-slate-900 rounded-3xl p-6 border border-slate-800 shadow-xl flex flex-col items-center text-center space-y-4 text-white">
              <span className="bg-emerald-500 text-slate-950 px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-wider">
                Passo 2: Confirmar Presença
              </span>
              <p className="text-xs text-slate-400 max-w-xs font-medium leading-relaxed">
                Após salvar o perfil, use o scanner do aplicativo para ler este código dinâmico e confirmar sua presença.
              </p>
              
              <div className="bg-white p-3 rounded-2xl transition-transform hover:scale-[1.02]">
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(activeToken.replace("LIVE-", ""))}`} 
                  className="w-40 h-40 object-contain bg-white" 
                  alt="QR Token"
                  referrerPolicy="no-referrer"
                />
              </div>

              <div className="flex flex-col items-center gap-2.5 w-full">
                <div className="bg-emerald-500/10 text-emerald-400 px-6 py-3 rounded-2xl font-mono text-2xl font-black tracking-widest border border-emerald-500/20 shadow-inner">
                  {activeToken}
                </div>
                <div className="bg-white/5 border border-white/10 px-4 py-2 rounded-xl text-xs text-slate-300 font-medium">
                  Atualização automática em: <span className="font-mono text-emerald-400 font-bold ml-1">{Math.ceil(timeLeftMs / 1000)}s</span>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT SIDE: ATTENDANCE REAL-TIME MONITORING */}
          <div className="col-span-1 lg:col-span-3">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full min-h-[500px]">
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-blue-50 text-[#0066ff] rounded-xl">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">Estudantes Confirmados</h3>
                    <p className="text-[10px] text-slate-500 font-medium">Sincronização instantânea entre múltiplos dispositivos</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <button 
                    onClick={handleAddDemoStudent}
                    className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[10px] font-extrabold px-3 py-2 rounded-xl border border-indigo-100 transition-colors cursor-pointer"
                  >
                    + Simular Entrada
                  </button>
                  <button 
                    onClick={handleDownloadCSV}
                    disabled={attendances.length === 0}
                    className="bg-[#0066ff] hover:bg-blue-700 disabled:bg-slate-100 disabled:text-slate-400 text-white text-[10px] font-extrabold px-3 py-2 rounded-xl transition-all shadow-sm cursor-pointer"
                  >
                    Exportar CSV
                  </button>
                </div>
              </div>

              {/* LIST BODY */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2 max-h-[520px]">
                {attendances.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 text-center py-16">
                    <TableProperties className="w-8 h-8 mb-2 text-slate-300 stroke-[1.5]" />
                    <p className="text-xs font-bold text-slate-500">Nenhuma presença computada ainda</p>
                    <p className="text-[11px] text-slate-400 max-w-xs mt-1">Os alunos aparecerão em tempo real conforme realizarem o check-in.</p>
                  </div>
                ) : (
                  attendances.map((item) => (
                    <div 
                      key={item.id} 
                      className="p-3 bg-white border border-slate-100 rounded-2xl flex items-center justify-between text-xs hover:bg-slate-50 hover:border-slate-200 transition-all shadow-sm"
                    >
                      <div className="space-y-0.5 truncate pr-4">
                        <p className="font-extrabold text-slate-800 truncate">{item.studentName}</p>
                        <p className="text-[10px] text-slate-500 font-medium truncate">
                          {item.course} • <span className="text-slate-400">{item.semester}</span>
                        </p>
                      </div>
                      <div className="text-right shrink-0 flex flex-col items-end gap-1">
                        <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md font-mono font-black text-[10px] border border-emerald-100">
                          {item.tokenUsed}
                        </span>
                        <p className="text-[9px] font-bold text-slate-400">
                          {new Date(item.scannedAt).toLocaleTimeString('pt-BR')}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* FOOTER COUNT */}
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-xs font-bold text-slate-600">
                <span>Total de Alunos: {attendances.length}</span>
                <button 
                  onClick={handleResetData}
                  className="text-red-600 hover:text-red-700 font-semibold cursor-pointer transition-colors flex items-center gap-1 text-[11px]"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Limpar Registros
                </button>
              </div>
            </div>
          </div>
        </main>
      ) : (
        /* CELLPHONE VIEW FOR STUDENTS */
        <main className="flex-1 max-w-md mx-auto w-full p-4 flex flex-col justify-center">
          {!currentStudent ? (
            /* ENROLLMENT INTERFACE */
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xl space-y-5">
              <div className="text-center space-y-1">
                <h2 className="text-base font-black text-slate-800">Identificação do Aluno</h2>
                <p className="text-xs text-slate-500">Insira suas informações acadêmicas para assinar a lista</p>
              </div>
              <form onSubmit={handleEnrollStudent} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider block">Nome Completo</label>
                  <input 
                    type="text" 
                    required 
                    placeholder="Seu nome completo" 
                    value={studentName} 
                    onChange={(e) => setStudentName(e.target.value)} 
                    className="w-full text-xs p-3 rounded-xl border border-slate-200 outline-none bg-slate-50 focus:border-[#0066ff] focus:bg-white transition-all font-medium" 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider block">Curso Atual</label>
                  <input 
                    type="text" 
                    required 
                    placeholder="Ex: Engenharia de Software" 
                    value={studentCourse} 
                    onChange={(e) => setStudentCourse(e.target.value)} 
                    className="w-full text-xs p-3 rounded-xl border border-slate-200 outline-none bg-slate-50 focus:border-[#0066ff] focus:bg-white transition-all font-medium" 
                  />
                </div>
                <button 
                  type="submit" 
                  className="w-full mt-2 bg-[#0066ff] hover:bg-blue-700 text-white font-black text-xs py-3.5 rounded-xl cursor-pointer shadow-md shadow-blue-500/10 transition-all active:scale-[0.99]"
                >
                  Avançar para Validador
                </button>
              </form>
            </div>
          ) : (
            /* SCANNER & SUBMIT INTERFACE */
            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xl space-y-4">
              <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl text-xs border border-slate-100">
                <div className="truncate pr-3">
                  <p className="font-extrabold text-slate-700 truncate">📍 {currentStudent.name}</p>
                  <p className="text-[10px] text-slate-400 font-medium truncate">{currentStudent.course}</p>
                </div>
                <button 
                  onClick={() => { 
                    setCurrentStudent(null); 
                    localStorage.removeItem('onclass_pres_active_student'); 
                  }} 
                  className="text-red-500 text-[10px] font-bold underline shrink-0 hover:text-red-600 cursor-pointer"
                >
                  Trocar Perfil
                </button>
              </div>

              {hasAlreadyCheckedIn || scanStatus.type === 'success' ? (
                <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-2xl text-center space-y-2 text-emerald-800 animate-fade-in">
                  <CheckCircle className="w-8 h-8 mx-auto text-emerald-600 stroke-[2]" />
                  <p className="text-xs font-black">Presença Confirmada!</p>
                  <p className="text-[11px] text-emerald-600 font-medium leading-relaxed">
                    Seu registro foi enviado e já está visível na tela do professor. Você pode fechar esta página.
                  </p>
                </div>
              ) : (
                <>
                  {/* LIVE CAMERA CONTAINER */}
                  <div className="relative aspect-square w-full max-w-[260px] mx-auto bg-slate-950 rounded-2xl overflow-hidden flex items-center justify-center border border-slate-800 shadow-inner">
                    <div id="qr-reader-container" className="absolute inset-0 w-full h-full object-cover"></div>
                    {!isCameraActive && (
                      <div className="text-slate-400 text-center p-5 z-10 space-y-2">
                        <Camera className="w-7 h-7 mx-auto text-slate-500 animate-pulse" />
                        <p className="text-[11px] font-bold">Iniciando câmera traseira...</p>
                        <p className="text-[9px] text-slate-500 font-medium">Aponte para o QR Code de confirmação exibido no projetor.</p>
                      </div>
                    )}
                  </div>

                  {cameraPermissionError && (
                    <p className="text-[10px] text-amber-600 font-semibold text-center bg-amber-50 p-2 rounded-lg border border-amber-100">
                      {cameraPermissionError}
                    </p>
                  )}

                  <div className="text-center text-[10px] text-slate-400 font-black uppercase tracking-wider my-1">
                    Ou digite o código de tempo
                  </div>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      placeholder="Ex: AB12" 
                      value={manualCode} 
                      onChange={(e) => setManualCode(e.target.value)} 
                      className="flex-1 text-xs p-3 rounded-xl border border-slate-200 font-mono tracking-widest text-center uppercase outline-none bg-slate-50 focus:border-[#0066ff] focus:bg-white font-bold" 
                    />
                    <button 
                      onClick={() => handleScanOrSubmitCode(manualCode)} 
                      disabled={isLoading || !manualCode.trim()} 
                      className="bg-[#0066ff] hover:bg-blue-700 disabled:bg-slate-200 text-white font-black text-xs px-5 rounded-xl transition-all cursor-pointer shadow-sm"
                    >
                      Validar
                    </button>
                  </div>

                  {scanStatus.type !== 'idle' && (
                    <div className={`p-3 rounded-xl text-xs font-bold border transition-all ${
                      scanStatus.type === 'error' 
                        ? 'bg-red-50 border-red-100 text-red-700' 
                        : 'bg-emerald-50 border-emerald-100 text-emerald-700'
                    }`}>
                      {scanStatus.message}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </main>
      )}
    </div>
  );
}

```
