import { Server as SocketIOServer } from "socket.io";
import type { Server as HttpServer } from "node:http";
import { resolveProjectFromToken } from "./resolveProjectFromToken";

let io: SocketIOServer;

export const initSocket = (server: HttpServer) => {
  io = new SocketIOServer(server, {
    cors: {
      origin:
        process.env.NODE_ENV === "production"
          ? process.env.FRONTEND_URL
          : "http://localhost:5173",
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    console.log("🔌 Socket connected:", socket.id);

    // 🔑 Explicit project join
    socket.on("join-project", async ({ token }) => {
      if (!token) {
        socket.emit("error", { message: "Token required" });
        return;
      }

      const result = await resolveProjectFromToken(token);

      if (!result) {
        socket.emit("error", { message: "Invalid token" });
        return;
      }

      const { projectId, role } = result;

      socket.join(`project:${projectId}`);

      // Store context on socket
      socket.data.projectId = projectId;
      socket.data.role = role;

      socket.emit("joined-project", {
        projectId,
        role,
      });
    });

    socket.on("disconnect", () => {
      console.log("🔌 Socket disconnected:", socket.id);
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error("Socket.IO not initialized");
  }
  return io;
};
