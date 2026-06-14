import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

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

// In-Memory Database for Presentation Mode
let presentationStudents: PresentationStudent[] = [];
let presentationAttendances: PresentationAttendance[] = [];
let currentToken = "LIVE-ON95";
let previousToken = "";
let lastTokenUpdate = Date.now();

interface PresentationSlide {
  id: string;
  title: string;
  imageUrl: string;
}

let presentationSlides: PresentationSlide[] = [
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
let activeSlideIndex = 0;

function generateNewToken() {
  const chars = "ABCDEFGHJKLMNOPQRSTUVWXYZ23456789"; 
  let code = "LIVE-";
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Rotate token every 10 seconds automatically
setInterval(() => {
  previousToken = currentToken;
  currentToken = generateNewToken();
  lastTokenUpdate = Date.now();
}, 10000);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware to support JSON body parsing
  app.use(express.json());

  // Serve simple status API
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // --- PRESENTATION MODE REAL-TIME ENDPOINTS ---
  
  // Get active state / pool status
  app.get("/api/presentation/status", (req, res) => {
    const now = Date.now();
    const elapsed = now - lastTokenUpdate;
    const timeLeftMs = Math.max(0, 10000 - elapsed);

    res.json({
      activeToken: currentToken,
      previousToken: previousToken,
      timeLeftMs: timeLeftMs,
      students: presentationStudents,
      attendances: presentationAttendances,
      slides: presentationSlides,
      activeSlideIndex: activeSlideIndex,
    });
  });

  // Set current active slide
  app.post("/api/presentation/slides/active", (req, res) => {
    const { index } = req.body;
    if (index === undefined || index < 0 || index >= presentationSlides.length) {
      return res.status(400).json({ error: "Índice de slide inválido" });
    }
    activeSlideIndex = Number(index);
    res.json({ success: true, activeSlideIndex });
  });

  // Add custom slide link/image
  app.post("/api/presentation/slides/add", (req, res) => {
    const { title, imageUrl } = req.body;
    if (!title || !imageUrl) {
      return res.status(400).json({ error: "Título e link da imagem são obrigatórios" });
    }
    const newSlide: PresentationSlide = {
      id: "slide-" + Math.random().toString(36).substring(2, 9),
      title: String(title).trim(),
      imageUrl: String(imageUrl).trim()
    };
    presentationSlides.push(newSlide);
    res.json({ success: true, slides: presentationSlides });
  });

  // Delete custom slide
  app.post("/api/presentation/slides/delete", (req, res) => {
    const { id } = req.body;
    if (!id) {
      return res.status(400).json({ error: "ID do slide é obrigatório" });
    }
    if (presentationSlides.length <= 1) {
      return res.status(400).json({ error: "Deve haver pelo menos 1 slide ativo no painel." });
    }
    const indexToDelete = presentationSlides.findIndex(s => s.id === id);
    if (indexToDelete === -1) {
      return res.status(404).json({ error: "Slide não encontrado" });
    }
    
    presentationSlides.splice(indexToDelete, 1);
    // Ensure active index is within bounds
    if (activeSlideIndex >= presentationSlides.length) {
      activeSlideIndex = presentationSlides.length - 1;
    }
    res.json({ success: true, slides: presentationSlides, activeSlideIndex });
  });

  // Enroll a student
  app.post("/api/presentation/enroll", (req, res) => {
    const { name, course, semester } = req.body;
    if (!name || !course || !semester) {
      return res.status(400).json({ error: "Preencha todos os campos (Nome, Curso e Semestre)" });
    }

    const newStudent: PresentationStudent = {
      id: "std-" + Math.random().toString(36).substring(2, 9),
      name: String(name).trim(),
      course: String(course).trim(),
      semester: String(semester).trim(),
      enrolledAt: new Date().toISOString(),
    };

    presentationStudents.push(newStudent);
    res.json({ success: true, student: newStudent });
  });

  // Scan attendance
  app.post("/api/presentation/scan", (req, res) => {
    const { studentId, token } = req.body;
    if (!studentId || !token) {
      return res.status(400).json({ error: "Dados inválidos: ID do estudante e Token são necessários" });
    }

    const student = presentationStudents.find(s => s.id === studentId);
    if (!student) {
      return res.status(404).json({ error: "Este perfil de aluno não foi encontrado! Favorite se recadastrar." });
    }

    // Check pre-existing attendance
    const alreadyPresent = presentationAttendances.some(a => a.studentId === studentId);
    if (alreadyPresent) {
      return res.status(400).json({ error: "Você já registrou sua presença nesta chamada!" });
    }

    // Verify token with tolerant rotation buffer (current token or previous token within boundary)
    const upperToken = String(token).trim().toUpperCase();
    const isValidToken = upperToken === currentToken || upperToken === previousToken;

    if (!isValidToken) {
      return res.status(400).json({ error: "QR Code Expirado ou Código Inválido! Tente novamente com o código atualizado de 10s." });
    }

    const newAttendance: PresentationAttendance = {
      id: "att-" + Math.random().toString(36).substring(2, 9),
      studentId: student.id,
      studentName: student.name,
      course: student.course,
      semester: student.semester,
      scannedAt: new Date().toISOString(),
      tokenUsed: upperToken,
    };

    presentationAttendances.unshift(newAttendance); // latest attendance first
    res.json({ success: true, message: "Presença registrada com sucesso! Olhe no projetor 🎉" });
  });

  // Reset presentation data
  app.post("/api/presentation/reset", (req, res) => {
    presentationStudents = [];
    presentationAttendances = [];
    previousToken = "";
    currentToken = generateNewToken();
    lastTokenUpdate = Date.now();
    activeSlideIndex = 0;
    res.json({ success: true, message: "Histórico reiniciado para nova simulação!" });
  });

  // Vite middleware for development vs static build for production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
