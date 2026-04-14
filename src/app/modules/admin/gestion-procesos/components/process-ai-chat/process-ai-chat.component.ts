/**
 * AI Chat Component for Judicial Processes
 * 
 * CURRENT STATUS: MAQUETADO (UI only)
 * The UI is fully responsive and mimics ChatGPT/Gemini behavior.
 * Currently using mock data and signals for local state management.
 * 
 * NEXT STEPS FOR RAG INTEGRATION:
 * 1. Create a service to handle streaming chat responses from the backend.
 * 2. Replace the local 'sessions' and 'selectedSession' signals with real persistent data.
 * 3. Implement the 'sendMessage' method to call the backend API (Streaming/SSE).
 * 4. Add markdown rendering (e.g., ngx-markdown) for formatted AI responses.
 * 5. Handle error states and loading animations for a premium feel.
 */
import { Component, Input, Output, EventEmitter, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ChatSession {
  id: string;
  title: string;
  lastMessage?: string;
  updatedAt: Date;
  messages: ChatMessage[];
}

@Component({
  selector: 'app-process-ai-chat',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, TranslocoPipe],
  templateUrl: './process-ai-chat.component.html',
  styleUrls: ['./process-ai-chat.component.scss']
})
export class ProcessAiChatComponent {
  @Input({ required: true }) isOpen = false;
  @Input({ required: true }) processId!: number | string;
  @Output() closed = new EventEmitter<void>();

  // Mock data for sessions
  sessions = signal<ChatSession[]>([
    {
      id: '1',
      title: 'Análisis de la última actuación',
      lastMessage: 'El auto del 12 de marzo indica que...',
      updatedAt: new Date(),
      messages: [
        { id: 'm1', role: 'user', content: '¿Qué dice la última actuación?', timestamp: new Date() },
        { id: 'm2', role: 'assistant', content: 'La última actuación del 12 de marzo es un auto que ordena el traslado a la contraparte por un término de 3 días...', timestamp: new Date() }
      ]
    },
    {
      id: '2',
      title: 'Resumen del proceso',
      lastMessage: 'Este proceso inició por una demanda de...',
      updatedAt: new Date(Date.now() - 3600000),
      messages: []
    }
  ]);

  selectedSessionId = signal<string | null>('1');
  
  selectedSession = computed(() => {
    const id = this.selectedSessionId();
    return this.sessions().find(s => s.id === id) || null;
  });

  newMessage = signal('');

  close() {
    this.closed.emit();
  }

  createNewChat() {
    const newId = (this.sessions().length + 1).toString();
    const newSession: ChatSession = {
      id: newId,
      title: 'Nuevo Chat ' + newId,
      updatedAt: new Date(),
      messages: []
    };
    this.sessions.update(s => [newSession, ...s]);
    this.selectedSessionId.set(newId);
  }

  selectSession(id: string) {
    this.selectedSessionId.set(id);
  }

  sendMessage() {
    if (!this.newMessage().trim() || !this.selectedSessionId()) return;

    const currentId = this.selectedSessionId()!;
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: this.newMessage(),
      timestamp: new Date()
    };

    // Update sessions
    this.sessions.update(prev => 
      prev.map(s => s.id === currentId 
        ? { ...s, messages: [...s.messages, userMsg], updatedAt: new Date(), lastMessage: userMsg.content } 
        : s
      )
    );

    this.newMessage.set('');

    // Mock AI response
    setTimeout(() => {
      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Como asistente judicial, estoy analizando tu solicitud. Por ahora, esta es una respuesta de prueba.',
        timestamp: new Date()
      };
      this.sessions.update(prev => 
        prev.map(s => s.id === currentId 
          ? { ...s, messages: [...s.messages, aiMsg], updatedAt: new Date(), lastMessage: aiMsg.content } 
          : s
        )
      );
    }, 1000);
  }
}
