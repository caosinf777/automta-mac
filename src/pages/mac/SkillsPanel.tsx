/**
 * SkillsPanel — Grid visual de Skills activas del agente en Mac
 * Muestra qué skills del agente están activas y cuáles tienen acceso local al Mac
 * Usa la terminología de AutoMTA: "Skills" (no "poderes" ni "capacidades")
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen,
  Monitor,
  Globe,
  Mail,
  Calendar,
  Folder,
  Clipboard,
  Search,
  Zap,
  ChevronRight,
  CheckCircle,
  AlertCircle,
  Lock,
} from 'lucide-react';
import { AgentCapabilities } from '../../hooks/useAgentCompanion';

// ─── Types ──────────────────────────────────────────────────────────────────────
export interface SkillItem {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  iconBg: string;
  isCloud: boolean;     // Viene configurada desde la web
  isLocal: boolean;     // Tiene acceso a recursos locales del Mac
  isActive: boolean;
  localLabel?: string;  // Qué recurso local usa (ej: "Calendar de Mac")
  requiresPermission?: 'screen' | 'accessibility';
}

interface SkillsPanelProps {
  capabilities?: AgentCapabilities;
  compact?: boolean;    // Versión compacta para el mini panel
}

// ─── Skill Icons Config ─────────────────────────────────────────────────────────
const ICON_SIZE = 'w-4 h-4';

const LOCAL_MAC_SKILLS: SkillItem[] = [
  {
    id: 'computer-use',
    label: 'Computer Use',
    description: 'El agente controla tu Mac directamente',
    icon: <Monitor className={ICON_SIZE} />,
    iconBg: 'from-purple-600 to-indigo-600',
    isCloud: true,
    isLocal: true,
    localLabel: 'Control de pantalla',
    isActive: true,
    requiresPermission: 'screen',
  },
  {
    id: 'knowledge-base',
    label: 'Base de Conocimiento',
    description: 'Documentos y datos configurados en la plataforma',
    icon: <BookOpen className={ICON_SIZE} />,
    iconBg: 'from-blue-600 to-cyan-600',
    isCloud: true,
    isLocal: false,
    isActive: true,
  },
  {
    id: 'files',
    label: 'Archivos Mac',
    description: 'Lee y crea archivos en tu Mac',
    icon: <Folder className={ICON_SIZE} />,
    iconBg: 'from-amber-600 to-orange-600',
    isCloud: false,
    isLocal: true,
    localLabel: '~/Documents, ~/Desktop',
    isActive: true,
  },
  {
    id: 'calendar',
    label: 'Calendar',
    description: 'Ve y crea eventos en tu calendario',
    icon: <Calendar className={ICON_SIZE} />,
    iconBg: 'from-red-600 to-rose-600',
    isCloud: false,
    isLocal: true,
    localLabel: 'Calendar de Mac',
    isActive: true,
  },
  {
    id: 'mail',
    label: 'Mail',
    description: 'Lee tus correos no leídos',
    icon: <Mail className={ICON_SIZE} />,
    iconBg: 'from-sky-600 to-blue-600',
    isCloud: false,
    isLocal: true,
    localLabel: 'Mail de Mac',
    isActive: true,
  },
  {
    id: 'clipboard',
    label: 'Clipboard',
    description: 'Accede y copia al portapapeles',
    icon: <Clipboard className={ICON_SIZE} />,
    iconBg: 'from-teal-600 to-emerald-600',
    isCloud: false,
    isLocal: true,
    localLabel: 'Portapapeles del sistema',
    isActive: true,
  },
  {
    id: 'spotlight',
    label: 'Spotlight Search',
    description: 'Busca archivos en tu Mac con Spotlight',
    icon: <Search className={ICON_SIZE} />,
    iconBg: 'from-slate-500 to-slate-600',
    isCloud: false,
    isLocal: true,
    localLabel: 'Búsqueda de Mac',
    isActive: true,
  },
  {
    id: 'web',
    label: 'Web Search',
    description: 'Busca información en internet',
    icon: <Globe className={ICON_SIZE} />,
    iconBg: 'from-green-600 to-emerald-600',
    isCloud: true,
    isLocal: false,
    isActive: true,
  },
];

// ─── Skill Badge (Compact) ──────────────────────────────────────────────────────
export const SkillBadge: React.FC<{ skill: SkillItem }> = ({ skill }) => (
  <div
    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium shrink-0"
    style={{
      background: 'rgba(255,255,255,0.06)',
      border: '1px solid rgba(255,255,255,0.08)',
    }}
  >
    <div className={`w-4 h-4 rounded-md bg-gradient-to-br ${skill.iconBg} flex items-center justify-center`}>
      <div className="text-white scale-75">{skill.icon}</div>
    </div>
    <span className="text-slate-300">{skill.label}</span>
    <div className={`w-1.5 h-1.5 rounded-full ${skill.isActive ? 'bg-emerald-400' : 'bg-slate-600'}`} />
  </div>
);

// ─── Skill Card (Full) ──────────────────────────────────────────────────────────
const SkillCard: React.FC<{ skill: SkillItem; onClick?: () => void }> = ({ skill, onClick }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02 }}
      onClick={onClick}
      className="relative flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-all group"
      style={{
        background: skill.isActive
          ? 'rgba(124, 58, 237, 0.08)'
          : 'rgba(255,255,255,0.03)',
        border: skill.isActive
          ? '1px solid rgba(124, 58, 237, 0.2)'
          : '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {/* Icon */}
      <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${skill.iconBg} flex items-center justify-center shrink-0 shadow-lg`}>
        <div className="text-white">{skill.icon}</div>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-white truncate">{skill.label}</p>
          {skill.isCloud && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full text-purple-400 shrink-0"
              style={{ background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.2)' }}>
              Web
            </span>
          )}
          {skill.isLocal && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full text-emerald-400 shrink-0"
              style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}>
              Mac
            </span>
          )}
        </div>
        <p className="text-xs text-slate-500 truncate mt-0.5">{skill.description}</p>
        {skill.isLocal && skill.localLabel && (
          <p className="text-[10px] text-slate-600 mt-0.5 flex items-center gap-1">
            <Folder className="w-2.5 h-2.5" />{skill.localLabel}
          </p>
        )}
      </div>

      {/* Status */}
      <div className="shrink-0">
        {skill.isActive ? (
          <CheckCircle className="w-4 h-4 text-emerald-400" />
        ) : (
          <AlertCircle className="w-4 h-4 text-slate-600" />
        )}
      </div>

      {/* Arrow on hover */}
      <ChevronRight className="w-3.5 h-3.5 text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity absolute right-3 top-1/2 -translate-y-1/2" />
    </motion.div>
  );
};

// ─── Main SkillsPanel ───────────────────────────────────────────────────────────
const SkillsPanel: React.FC<SkillsPanelProps> = ({ capabilities, compact = false }) => {
  const [selectedSkill, setSelectedSkill] = useState<SkillItem | null>(null);
  const [filter, setFilter] = useState<'all' | 'web' | 'mac'>('all');

  // Merge platform capabilities with local Mac skills
  const skills = LOCAL_MAC_SKILLS.map(skill => {
    if (skill.id === 'knowledge-base') {
      return { ...skill, isActive: !!capabilities?.hasKnowledgeBase };
    }
    if (skill.id === 'web') {
      const hasTool = capabilities?.tools?.some(t =>
        t.name.toLowerCase().includes('search') || t.name.toLowerCase().includes('web')
      );
      return { ...skill, isActive: !!hasTool };
    }
    return skill;
  });

  // Add cloud tools from agent capabilities
  const cloudTools: SkillItem[] = (capabilities?.tools || [])
    .filter(t => !LOCAL_MAC_SKILLS.some(s => s.id === t.name.toLowerCase()))
    .map(t => ({
      id: t.name,
      label: t.name,
      description: 'Skill configurada en la plataforma AutoMTA',
      icon: <Zap className={ICON_SIZE} />,
      iconBg: 'from-violet-600 to-purple-600',
      isCloud: true,
      isLocal: false,
      isActive: t.enabled,
    }));

  const allSkills = [...skills, ...cloudTools];

  const filtered = allSkills.filter(s => {
    if (filter === 'web') return s.isCloud;
    if (filter === 'mac') return s.isLocal;
    return true;
  });

  if (compact) {
    // Compact mode: just the scrollable badge row
    return (
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {allSkills.filter(s => s.isActive).map(skill => (
          <SkillBadge key={skill.id} skill={skill} />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base font-bold text-white">Skills Activas</h2>
          <span className="text-xs text-slate-500">
            {allSkills.filter(s => s.isActive).length} de {allSkills.length} activas
          </span>
        </div>
        <p className="text-xs text-slate-500">
          Skills de la plataforma web + recursos nativos de tu Mac
        </p>

        {/* Filter tabs */}
        <div className="flex gap-1 mt-3 p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
          {(['all', 'web', 'mac'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${
                filter === f
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {f === 'all' ? 'Todas' : f === 'web' ? '🌐 Web' : '🖥️ Mac'}
            </button>
          ))}
        </div>
      </div>

      {/* Skills Grid */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
        {/* Legend */}
        <div className="flex items-center gap-3 px-1 mb-3">
          <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
            <span className="w-2 h-2 rounded-full bg-purple-500 inline-block" />
            Web — Configurada en AutoMTA
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
            Mac — Recurso local
          </div>
        </div>

        {filtered.map((skill, i) => (
          <motion.div
            key={skill.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
          >
            <SkillCard
              skill={skill}
              onClick={() => setSelectedSkill(selectedSkill?.id === skill.id ? null : skill)}
            />

            {/* Expanded detail */}
            <AnimatePresence>
              {selectedSkill?.id === skill.id && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mx-1 mb-2 p-3 rounded-xl text-xs"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <p className="text-slate-400 mb-2">{skill.description}</p>
                    <div className="space-y-1">
                      {skill.isCloud && (
                        <div className="flex items-center gap-2 text-purple-400">
                          <Globe className="w-3 h-3" />
                          <span>Configurada en tu cuenta de AutoMTA</span>
                        </div>
                      )}
                      {skill.isLocal && skill.localLabel && (
                        <div className="flex items-center gap-2 text-emerald-400">
                          <Folder className="w-3 h-3" />
                          <span>Acceso a: {skill.localLabel}</span>
                        </div>
                      )}
                      {skill.requiresPermission && (
                        <div className="flex items-center gap-2 text-amber-400 mt-2">
                          <Lock className="w-3 h-3" />
                          <span>
                            Requiere permiso de {skill.requiresPermission === 'screen'
                              ? 'Grabación de Pantalla'
                              : 'Accesibilidad'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}

        {filtered.length === 0 && (
          <div className="text-center py-8 text-slate-600 text-sm">
            No hay skills en esta categoría
          </div>
        )}
      </div>
    </div>
  );
};

export default SkillsPanel;
