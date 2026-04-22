/**
 * Lexa AI Chat Panel
 * Colors: brand palette from colors.config.ts (#4B2A7D primary, #371B58 dark, #7C57B7 secondary)
 * Fixed/Pinned modes + Global sidebar control
 */
import {
  Component, Input, Output, EventEmitter,
  signal, computed, ViewChild, ElementRef,
  OnChanges, SimpleChanges, OnDestroy, ChangeDetectionStrategy,
  inject, ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MarkdownComponent } from 'ngx-markdown';
import { AiChatService } from 'src/app/core/services/ai-chat/ai-chat.service';
import { AiChatSession as LocalAiChatSession } from 'src/app/core/models/ai-chat/ai-chat-session.model';
import { finalize } from 'rxjs';

export type QueryMode = 'agil' | 'estrategico';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  duration?: string; // Total response time
}

export interface ChatSession {
  id: string;
  title: string;
  lastMessage?: string;
  updatedAt: Date;
  messages: ChatMessage[];
  fullDate?: string;
}

interface Suggestion {
  text: string;
}

@Component({
  selector: 'app-process-ai-chat',
  standalone: true,
  imports: [CommonModule, FormsModule, MarkdownComponent],
  templateUrl: './process-ai-chat.component.html',
  styleUrls: ['./process-ai-chat.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProcessAiChatComponent implements OnChanges, OnDestroy {

  @Input({ required: true }) isOpen = false;
  @Input({ required: true }) processId!: string | number;
  @Output() closed = new EventEmitter<void>();
  @Output() pinnedChanged = new EventEmitter<boolean>();

  @ViewChild('messagesContainer') messagesContainer?: ElementRef<HTMLDivElement>;

  // ── Custom tooltip (fixed position, bypasses overflow:hidden) ─────
  private _cdr = inject(ChangeDetectorRef);
  tooltipVisible  = false;
  tooltipText     = '';
  tooltipX        = 0;
  tooltipY        = 0;

  // ── Typing & Thinking State ──────────────────────────────────────
  isWaitingFirstChunk = signal(false);
  responseTime        = signal<string | null>(null);
  private _startTime  = 0;
  private _typeInterval: any = null;
  private _chunkQueue: string[] = [];

  private readonly thinkingLabels = [
    'Lexa está analizando el expediente...',
    'Conectando hechos y actuaciones...',
    'Consultando base de conocimientos...',
    'Preparando análisis judicial...',
    'Generando respuesta estratégica...',
  ];
  currentThinkingLabel = signal(this.thinkingLabels[0]);
  private _labelInterval: any = null;

  showTooltip(event: MouseEvent, text: string): void {
    if (!text) return;
    const rect = (event.target as HTMLElement).getBoundingClientRect();
    this.tooltipText    = text;
    this.tooltipX       = rect.right + 8;
    this.tooltipY       = rect.top + rect.height / 2;
    this.tooltipVisible = true;
    this._cdr.markForCheck();
  }

  hideTooltip(): void {
    this.tooltipVisible = false;
    this._cdr.markForCheck();
  }

  // ── UI state ──────────────────────────────────────────────────────
  showSidebar  = signal(false);
  isExpanded   = signal(false);
  isPinned     = signal(false);
  
  queryMode    = signal<QueryMode>('estrategico');
  messageText  = '';
  isTyping     = signal(false);
  inputFocused = false;
  
  streamingMessageId = signal<string | null>(null);
  streamingContent   = signal<string>('');

  private readonly agileSuggestions: Suggestion[] = [
    { text: '¿Cuándo fueron los hechos?' },
    { text: 'Resumen de actuaciones' },
    { text: 'Fecha última notificación' },
  ];
  private readonly strategicSuggestions: Suggestion[] = [
    { text: 'Análisis de contradicciones' },
    { text: 'Riesgos del proceso' },
    { text: 'Estrategia de defensa' },
  ];

  currentSuggestions = computed(() => 
    this.queryMode() === 'agil' ? this.agileSuggestions : this.strategicSuggestions
  );

  // ── Active stream controller (to cancel on destroy) ──────────────
  private _activeStream: AbortController | null = null;
  private _aiService = inject(AiChatService);

  // ── Lifecycle ─────────────────────────────────────────────────────
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['processId'] && this.processId) {
      this.loadHistory();
    }
  }

  ngOnDestroy(): void { 
    this._activeStream?.abort();
    this.stopTypewriter();
    this.clearLabelInterval();
  }

  private startLabelRotation(): void {
    this.clearLabelInterval();
    let idx = 0;
    this._labelInterval = setInterval(() => {
      idx = (idx + 1) % this.thinkingLabels.length;
      this.currentThinkingLabel.set(this.thinkingLabels[idx]);
      this._cdr.markForCheck();
    }, 2500);
  }

  private clearLabelInterval(): void {
    if (this._labelInterval) clearInterval(this._labelInterval);
  }

  // ── History ───────────────────────────────────────────────────────
  sessions = signal<ChatSession[]>([]);
  selectedSessionId = signal<string | null>(null);
  selectedSession = computed(() => 
    this.sessions().find(s => s.id === this.selectedSessionId()) || null
  );

  loadHistory(): void {
    this._aiService.getSessionsByProcess(this.processId.toString())
      .subscribe(data => {
        const mapped: ChatSession[] = data.map(s => ({
          id: s.id,
          title: s.title || 'Chat sin título',
          updatedAt: new Date(),
          messages: [],
          fullDate: (s as any).created_at || ''
        }));
        this.sessions.set(mapped);
        if (mapped.length > 0) {
          const firstId = mapped[0].id;
          this.selectedSessionId.set(firstId);
          this.loadMessages(firstId);
        }
      });
  }

  // ── Panel ─────────────────────────────────────────────────────────
  close(): void { this.closed.emit(); }

  toggleSidebar(): void { this.showSidebar.update(v => !v); }
  
  toggleExpand(): void { this.isExpanded.update(v => !v); }
  
  togglePin(): void { 
    this.isPinned.update(v => !v); 
    this.pinnedChanged.emit(this.isPinned());
    if (this.isPinned()) this.isExpanded.set(false);
  }

  setMode(mode: QueryMode): void { this.queryMode.set(mode); }

  // ── Sessions ──────────────────────────────────────────────────────
  selectSession(id: string): void {
    if (this.selectedSessionId() === id) return;
    this.selectedSessionId.set(id);
    this.loadMessages(id);
  }

  private loadMessages(chatId: string): void {
    if (chatId.startsWith('new-')) return;
    
    this._aiService.getMessages(chatId).subscribe({
      next: (res) => {
        const messages: ChatMessage[] = res.map(m => ({
          id: m.id,
          role: m.role,
          content: m.content,
          timestamp: new Date(m.created_at || m.timestamp),
        }));

        this.sessions.update(prev => prev.map(s => s.id !== chatId ? s : {
          ...s,
          messages
        }));
        
        setTimeout(() => this.scrollToBottom(), 150);
        this._cdr.markForCheck();
      }
    });
  }

  createNewChat(): void {
    const id = `new-${Date.now()}`;
    this.sessions.update(prev => [
      { id, title: 'Nuevo chat', updatedAt: new Date(), messages: [] },
      ...prev,
    ]);
    this.selectedSessionId.set(id);
  }

  // ── Messaging ─────────────────────────────────────────────────────
  onKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.sendMessage(); }
  }

  sendSuggestion(text: string): void { this.messageText = text; this.sendMessage(); }

  sendMessage(): void {
    const content = this.messageText.trim();
    if (!content || this.isTyping()) return;

    if (!this.selectedSessionId()) this.createNewChat();
    const currentId = this.selectedSessionId()!;

    // 1. Add user message
    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: 'user', content, timestamp: new Date() };
    this.sessions.update(prev => prev.map(s => s.id !== currentId ? s : {
      ...s,
      messages: [...s.messages, userMsg],
      updatedAt: new Date(),
      lastMessage: content,
      title: s.messages.length === 0 ? this.truncate(content, 38) : s.title,
    }));
    this.messageText = '';
    this.scrollToBottom();

    // 2. Add AI placeholder
    const aiId = `ai-${Date.now()}`;
    const aiMsg: ChatMessage = { id: aiId, role: 'assistant', content: '', timestamp: new Date() };
    this.sessions.update(prev => prev.map(s => s.id !== currentId ? s : {
      ...s, messages: [...s.messages, aiMsg],
    }));

    // 3. Begin streaming state
    this.isTyping.set(true);
    this.isWaitingFirstChunk.set(true);
    this.responseTime.set(null);
    this.streamingMessageId.set(aiId);
    this.streamingContent.set('');
    this.messageText = '';
    this._startTime = Date.now();
    this._chunkQueue = [];

    // Reset textarea height and scroll immediately
    if (this.messagesContainer) {
      const ta = (this.messagesContainer.nativeElement as any).closest('.cpanel-main')?.querySelector('.input-ta') as HTMLTextAreaElement;
      if (ta) ta.style.height = 'auto';
      setTimeout(() => this.scrollToBottom(), 50);
    }

    this._cdr.markForCheck();

    const apiSearchMode = this.queryMode() === 'agil' ? 'agile' : 'strategic';

    this._activeStream?.abort();
    this._activeStream = this._aiService.sendMessage(currentId, content, apiSearchMode, {
      onChunk: (chunk) => {
        if (this.isWaitingFirstChunk()) {
          this.isWaitingFirstChunk.set(false);
          this.clearLabelInterval();
          this.startTypewriter();
        }
        this._chunkQueue.push(chunk);
      },
      onDone: () => {
        const elapsed = Date.now() - this._startTime;
        this.processFinalDone(aiId, currentId, elapsed);
      },
      onError: (err) => {
        this.isTyping.set(false);
        this.isWaitingFirstChunk.set(false);
        this.stopTypewriter();
        this.clearLabelInterval();
        this.sessions.update(prev => prev.map(s => ({
          ...s,
          messages: s.messages.map(m => m.id === aiId ? { ...m, content: '⚠️ Error de conexión.' } : m),
        })));
        this._cdr.markForCheck();
      },
    });
  }

  private startTypewriter(): void {
    this.stopTypewriter();
    let charBuffer: string[] = [];
    
    this._typeInterval = setInterval(() => {
      if (charBuffer.length === 0 && this._chunkQueue.length > 0) {
        const nextChunk = this._chunkQueue.shift()!;
        charBuffer = nextChunk.split('');
      }

      if (charBuffer.length > 0) {
        const char = charBuffer.shift()!;
        this.streamingContent.update(c => c + char);
        this.scrollToBottom();
        this._cdr.detectChanges();
      }
    }, 15); // Slightly slower for better visual tracking
  }

  private stopTypewriter(): void {
    if (this._typeInterval) clearInterval(this._typeInterval);
  }

  adjustHeight(el: any): void {
    const target = el.target || el;
    if (!(target instanceof HTMLTextAreaElement)) return;
    target.style.height = 'auto';
    target.style.height = target.scrollHeight + 'px';
  }

  private processFinalDone(aiId: string, currentId: string, elapsedMs: number): void {
    const checkFinish = setInterval(() => {
      if (this._chunkQueue.length === 0) {
        clearInterval(checkFinish);
        this.stopTypewriter();
        
        const finalContent = this.streamingContent();
        const duration = this.formatDuration(elapsedMs);
        
        this.sessions.update(prev => prev.map(s => ({
          ...s,
          messages: s.messages.map(m => 
            m.id === aiId ? { ...m, content: finalContent, duration } : m
          ),
          ...(s.id === currentId ? { lastMessage: finalContent } : {}),
        })));
        
        this.streamingMessageId.set(null);
        this.streamingContent.set('');
        this.isTyping.set(false);
        this._activeStream = null;
        this.scrollToBottom();
        this._cdr.markForCheck();
      }
    }, 100);
  }

  private formatDuration(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    if (totalSeconds < 60) return `${totalSeconds}s`;
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}m ${secs}s`;
  }

  getMessageContent(msg: ChatMessage): string {
    return this.streamingMessageId() === msg.id ? this.streamingContent() : msg.content;
  }

  copyMessage(content: string): void {
    navigator.clipboard.writeText(content).catch(() => {/* ignore */ });
  }

  editMessage(msg: ChatMessage): void {
    this.messageText = msg.content;
  }

  private scrollToBottom(): void {
    const el = this.messagesContainer?.nativeElement;
    if (el) el.scrollTop = el.scrollHeight;
  }
  private truncate(s: string, max: number): string {
    return s.length > max ? s.slice(0, max).trimEnd() + '…' : s;
  }
}
