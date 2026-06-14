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

function generateNewToken() {
  const chars = "ABCDEFGHJKLMNOPQRSTUVWXYZ23456789"; 
  let code = "LIVE-";
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Rotate token every 30 seconds automatically
setInterval(() => {
  previousToken = currentToken;
  currentToken = generateNewToken();
  lastTokenUpdate = Date.now();
}, 30000);

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
    const timeLeftMs = Math.max(0, 30000 - elapsed);

    res.json({
      activeToken: currentToken,
      previousToken: previousToken,
      timeLeftMs: timeLeftMs,
      students: presentationStudents,
      attendances: presentationAttendances,
    });
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
      return res.status(400).json({ error: "QR Code Expirado ou Código Inválido! Tente novamente com o código atualizado de 30s." });
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
