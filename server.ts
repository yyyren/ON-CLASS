import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

// Interfaces mantidas...
interface PresentationStudent { id: string; name: string; course: string; semester: string; enrolledAt: string; }
interface PresentationAttendance { id: string; studentId: string; studentName: string; course: string; semester: string; scannedAt: string; tokenUsed: string; }

let presentationStudents: PresentationStudent[] = [];
let presentationAttendances: PresentationAttendance[] = [];

// Aumentamos o tempo para 60 segundos para dar margem ao celular
let currentToken = "LIVE-ON95";
let previousToken = "";
let lastTokenUpdate = Date.now();

function generateNewToken() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; 
  let code = "LIVE-";
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// ROTAÇÃO DE 60 SEGUNDOS (O dobro do anterior)
setInterval(() => {
  previousToken = currentToken;
  currentToken = generateNewToken();
  lastTokenUpdate = Date.now();
  console.log(`Token atualizado: ${currentToken}. Tolerância ativa.`);
}, 60000); 

async function startServer() {
  const app = express();
  const PORT = 3000;
  app.use(express.json());

  // ROTA PARA BAIXAR O CSV (O que você pediu!)
  app.get("/api/download-csv", (req, res) => {
    const header = "Nome,Curso,Semestre,Data/Hora\n";
    const rows = presentationAttendances.map(a => 
      `"${a.studentName}","${a.course}","${a.semester}","${a.scannedAt}"`
    ).join("\n");
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="chamada.csv"');
    res.send(header + rows);
  });

  app.post("/api/presentation/scan", (req, res) => {
    const { studentId, token } = req.body;
    const upperToken = String(token).trim().toUpperCase();

    // TOLERÂNCIA: Aceita o token atual OU o anterior
    const isTokenValid = (upperToken === currentToken || upperToken === previousToken);

    if (!isTokenValid) {
      return res.status(400).json({ error: "Código expirado. Tente novamente." });
    }

    // Lógica de salvar presença...
    const student = presentationStudents.find(s => s.id === studentId);
    if (!student) return res.status(404).json({ error: "Aluno não encontrado." });
    
    presentationAttendances.unshift({
      id: "att-" + Math.random().toString(36).substring(2, 9),
      studentId: student.id,
      studentName: student.name,
      course: student.course,
      semester: student.semester,
      scannedAt: new Date().toISOString(),
      tokenUsed: upperToken,
    });

    res.json({ success: true, message: "Presença registrada!" });
  });

  // ... (mantenha o restante das rotas como estão)
  
  app.listen(PORT, "0.0.0.0", () => console.log(`Servidor rodando na porta ${PORT}`));
}

startServer();
