'use client';

import { useState, useEffect, useRef, memo } from 'react';
import type { ComponentTemplate, ComponentType, UserComponent } from '@/lib/types';
import { COMPONENT_TEMPLATES } from '@/lib/componentTemplates';
import {
  ChevronRight,
  ChevronDown,
  Table2,
  Filter,
  CircleDashed,
  AlertTriangle,
  FormInput,
  RectangleHorizontal,
  Square,
  Layers,
  Trash2,
  Edit2,
  MoreVertical,
  PackagePlus,
  Type,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface ComponentPanelProps {
  onInsertComponent: (template: ComponentTemplate) => void;
  userComponents?: UserComponent[];
  onInsertUserComponent?: (componentId: string, x: number, y: number) => void;
  onDeleteUserComponent?: (componentId: string) => void;
  onRenameUserComponent?: (componentId: string, newName: string) => void;
  getInstanceCount?: (componentId: string) => number;
  /** Whether the component panel is expanded */
  isExpanded: boolean;
  /** Callback when component panel is toggled */
  onToggle: () => void;
  /** The ID of the currently selected element group (if any) */
  selectedElementGroupId?: string | null;
  /** Callback to convert the selected group to a component */
  onConvertGroupToComponent?: (elementGroupId: string) => void;
}

export function ComponentPanel({
  onInsertComponent,
  userComponents = [],
  onInsertUserComponent,
  onDeleteUserComponent,
  onRenameUserComponent,
  getInstanceCount,
  isExpanded,
  onToggle,
  selectedElementGroupId,
  onConvertGroupToComponent,
}: ComponentPanelProps) {
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'my' | ComponentType>('all');
  const [isMyComponentsExpanded, setIsMyComponentsExpanded] = useState(true);
  const [isTemplatesExpanded, setIsTemplatesExpanded] = useState(true);
  const [editingComponentId, setEditingComponentId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  const categories: Array<{ id: 'all' | 'my' | ComponentType; label: string }> = [
    { id: 'all', label: 'All' },
    { id: 'my', label: 'My Components' },
    { id: 'table', label: 'Tables' },
    { id: 'empty-state', label: 'States' },
    { id: 'confirmation-modal', label: 'Modals' },
    { id: 'simple-form', label: 'Forms' },
  ];

  const filteredTemplates = selectedCategory === 'all' || selectedCategory === 'my'
    ? COMPONENT_TEMPLATES
    : COMPONENT_TEMPLATES.filter(t => {
        if (selectedCategory === 'table') {
          return t.type === 'table' || t.type === 'table-filters';
        }
        return t.type === selectedCategory;
      });

  const showUserComponents = selectedCategory === 'all' || selectedCategory === 'my';
  const showTemplates = selectedCategory !== 'my';

  const handleStartRename = (component: UserComponent) => {
    setEditingComponentId(component.id);
    setEditingName(component.name);
    setMenuOpenId(null);
  };

  const handleSaveRename = () => {
    if (editingComponentId && editingName.trim() && onRenameUserComponent) {
      onRenameUserComponent(editingComponentId, editingName.trim());
    }
    setEditingComponentId(null);
    setEditingName('');
  };

  const handleCancelRename = () => {
    setEditingComponentId(null);
    setEditingName('');
  };

  const handleDragStart = (e: React.DragEvent, componentId: string) => {
    e.dataTransfer.setData('application/x-user-component', componentId);
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <div
      className={`bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-700 flex flex-col h-full transition-all duration-200 motion-reduce:transition-none overflow-hidden ${
        isExpanded ? 'w-72' : 'w-0 border-l-0'
      }`}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-700 flex justify-between items-center">
        <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">Components</h2>
        <button
          onClick={onToggle}
          className="w-8 h-8 flex items-center justify-center text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 active:scale-95"
          title="Hide panel"
          aria-label="Hide components panel"
          aria-expanded="true"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Category filter */}
      <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-700">
        <div className="flex flex-wrap gap-2">
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 text-xs rounded-full transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                selectedCategory === cat.id
                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300 font-medium'
                  : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
              }`}
              aria-pressed={selectedCategory === cat.id}
            >
              {cat.label}
              {cat.id === 'my' && userComponents.length > 0 && (
                <span className="ml-1 text-xs opacity-70">({userComponents.length})</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Component list */}
      <div className="flex-1 overflow-y-auto">
        {/* My Components Section */}
        {showUserComponents && (
          <div className="border-b border-zinc-200 dark:border-zinc-700">
            <button
              onClick={() => setIsMyComponentsExpanded(!isMyComponentsExpanded)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setIsMyComponentsExpanded(!isMyComponentsExpanded);
                }
              }}
              className="w-full px-4 py-2 flex items-center justify-between text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500"
              role="button"
              aria-expanded={isMyComponentsExpanded}
              aria-controls="my-components-list"
            >
              <span className="flex items-center gap-2">
                <Layers size={16} />
                My Components
                {userComponents.length > 0 && (
                  <span className="text-xs bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300 px-1.5 py-0.5 rounded">
                    {userComponents.length}
                  </span>
                )}
              </span>
              {isMyComponentsExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>

            {isMyComponentsExpanded && (
              <div id="my-components-list" className="p-4 space-y-3">
                {/* Convert Group to Component button */}
                {selectedElementGroupId && onConvertGroupToComponent && (
                  <button
                    onClick={() => onConvertGroupToComponent(selectedElementGroupId)}
                    className="w-full flex items-center gap-2 px-3 py-2.5 bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800 rounded-lg text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900 hover:border-purple-300 dark:hover:border-purple-700 transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
                  >
                    <PackagePlus size={18} className="flex-shrink-0" />
                    <span className="text-sm font-medium">Convert Group to Component</span>
                  </button>
                )}
                {userComponents.length === 0 && !selectedElementGroupId ? (
                  <div className="text-center py-8 text-zinc-500 dark:text-zinc-400">
                    {/* Empty state illustration - grouped shapes */}
                    <svg
                      width="64"
                      height="64"
                      viewBox="0 0 64 64"
                      className="mx-auto mb-3 opacity-30"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      {/* Outer dashed group border */}
                      <rect
                        x="8"
                        y="8"
                        width="48"
                        height="48"
                        rx="4"
                        strokeDasharray="4 3"
                        className="opacity-50"
                      />
                      {/* Rectangle shape */}
                      <rect x="14" y="14" width="16" height="12" rx="1" />
                      {/* Circle shape */}
                      <circle cx="44" cy="20" r="7" />
                      {/* Diamond shape */}
                      <path d="M24 44 L32 36 L40 44 L32 52 Z" />
                      {/* Connecting dots */}
                      <circle cx="22" cy="30" r="1.5" fill="currentColor" />
                      <circle cx="37" cy="32" r="1.5" fill="currentColor" />
                    </svg>
                    <p className="text-sm font-medium mb-1">No components yet</p>
                    <p className="text-xs opacity-70">
                      Select elements and press{' '}
                      <kbd className="px-1 py-0.5 text-[10px] bg-zinc-100 dark:bg-zinc-800 rounded border border-zinc-200 dark:border-zinc-700">
                        Ctrl+Shift+C
                      </kbd>
                    </p>
                  </div>
                ) : userComponents.length === 0 ? (
                  null
                ) : (
                  userComponents.map(component => (
                    <UserComponentCard
                      key={component.id}
                      component={component}
                      isEditing={editingComponentId === component.id}
                      editingName={editingName}
                      onEditingNameChange={setEditingName}
                      onSaveRename={handleSaveRename}
                      onCancelRename={handleCancelRename}
                      onStartRename={handleStartRename}
                      onDelete={onDeleteUserComponent}
                      onInsert={onInsertUserComponent}
                      onDragStart={handleDragStart}
                      instanceCount={getInstanceCount?.(component.id) || 0}
                      menuOpen={menuOpenId === component.id}
                      onMenuToggle={(open) => setMenuOpenId(open ? component.id : null)}
                    />
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {/* Templates Section */}
        {showTemplates && (
          <div>
            <button
              onClick={() => setIsTemplatesExpanded(!isTemplatesExpanded)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setIsTemplatesExpanded(!isTemplatesExpanded);
                }
              }}
              className="w-full px-4 py-2 flex items-center justify-between text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500"
              role="button"
              aria-expanded={isTemplatesExpanded}
              aria-controls="templates-list"
            >
              <span className="flex items-center gap-2">
                <Square size={16} />
                Templates
              </span>
              {isTemplatesExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>

            {isTemplatesExpanded && (
              <div id="templates-list" className="p-4 space-y-3">
                {filteredTemplates.length === 0 ? (
                  <div className="text-center py-8 text-zinc-500 dark:text-zinc-400">
                    <CircleDashed size={32} className="mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No templates available</p>
                  </div>
                ) : (
                  filteredTemplates.map(template => (
                    <ComponentPreview
                      key={template.id}
                      template={template}
                      onInsert={onInsertComponent}
                    />
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer hint */}
      <div className="px-4 py-3 border-t border-zinc-200 dark:border-zinc-700 text-xs text-zinc-600 dark:text-zinc-400">
        Click to insert • Drag to position
      </div>
    </div>
  );
}

interface UserComponentCardProps {
  component: UserComponent;
  isEditing: boolean;
  editingName: string;
  onEditingNameChange: (name: string) => void;
  onSaveRename: () => void;
  onCancelRename: () => void;
  onStartRename: (component: UserComponent) => void;
  onDelete?: (componentId: string) => void;
  onInsert?: (componentId: string, x: number, y: number) => void;
  onDragStart: (e: React.DragEvent, componentId: string) => void;
  instanceCount: number;
  menuOpen: boolean;
  onMenuToggle: (open: boolean) => void;
}

const UserComponentCard = memo(function UserComponentCard({
  component,
  isEditing,
  editingName,
  onEditingNameChange,
  onSaveRename,
  onCancelRename,
  onStartRename,
  onDelete,
  onInsert,
  onDragStart,
  instanceCount,
  menuOpen,
  onMenuToggle,
}: UserComponentCardProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on click outside
  useEffect(() => {
    if (!menuOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onMenuToggle(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen, onMenuToggle]);

  // Close menu on Escape
  useEffect(() => {
    if (!menuOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onMenuToggle(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [menuOpen, onMenuToggle]);

  const handleClick = (e: React.MouseEvent) => {
    // Prevent click-through when editing
    if (isEditing) {
      e.stopPropagation();
      return;
    }
    if (onInsert) {
      // Insert at canvas center (approximate)
      onInsert(component.id, 500, 400);
    }
  };

  return (
    <div
      draggable={!isEditing}
      onDragStart={(e) => onDragStart(e, component.id)}
      onClick={handleClick}
      className={`relative border border-zinc-200 dark:border-zinc-700 rounded-lg p-3 transition-all duration-150 text-left group ${
        isEditing
          ? 'ring-2 ring-blue-500 cursor-default'
          : 'hover:border-purple-400 dark:hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-950 cursor-grab active:cursor-grabbing'
      }`}
    >
      {/* Thumbnail */}
      <div className="w-full h-16 bg-zinc-50 dark:bg-zinc-800 rounded mb-2 flex items-center justify-center border border-zinc-200 dark:border-zinc-700 overflow-hidden">
        {component.thumbnail ? (
          <img
            src={component.thumbnail}
            alt={component.name}
            className="max-w-full max-h-full object-contain"
          />
        ) : (
          <Layers
            size={24}
            className="text-purple-400 dark:text-purple-500 group-hover:text-purple-500 dark:group-hover:text-purple-400 transition-colors duration-150"
          />
        )}
      </div>

      {/* Name */}
      {isEditing ? (
        <input
          type="text"
          value={editingName}
          onChange={(e) => onEditingNameChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.stopPropagation();
              onSaveRename();
            } else if (e.key === 'Escape') {
              e.stopPropagation();
              onCancelRename();
            }
          }}
          onClick={(e) => e.stopPropagation()}
          onBlur={onSaveRename}
          autoFocus
          className="w-full px-2 py-1 text-sm border border-blue-400 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none"
        />
      ) : (
        <div className="font-medium text-sm text-zinc-900 dark:text-zinc-100 mb-1 truncate pr-6">
          {component.name}
        </div>
      )}

      {/* Metadata */}
      <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
        <span>{component.masterElements.length} elements</span>
        <span>•</span>
        <span>{Math.round(component.width)}×{Math.round(component.height)}</span>
        {instanceCount > 0 && (
          <>
            <span>•</span>
            <span className="text-purple-600 dark:text-purple-400">{instanceCount} uses</span>
          </>
        )}
      </div>

      {/* Menu button */}
      {!isEditing && (
        <div ref={menuRef} className="absolute top-2 right-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMenuToggle(!menuOpen);
            }}
            className="w-6 h-6 flex items-center justify-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            aria-label="Component options"
            aria-haspopup="true"
            aria-expanded={menuOpen}
          >
            <MoreVertical size={14} />
          </button>

          {/* Dropdown menu */}
          {menuOpen && (
            <div
              className="absolute right-0 top-7 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg py-1 z-10 min-w-[120px]"
              role="menu"
              aria-orientation="vertical"
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onStartRename(component);
                }}
                className="w-full px-3 py-1.5 text-left text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 flex items-center gap-2 focus:outline-none focus-visible:bg-zinc-100 dark:focus-visible:bg-zinc-700"
                role="menuitem"
              >
                <Edit2 size={14} />
                Rename
              </button>
              {onDelete && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(component.id);
                    onMenuToggle(false);
                  }}
                  className="w-full px-3 py-1.5 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 flex items-center gap-2 focus:outline-none focus-visible:bg-red-50 dark:focus-visible:bg-red-950"
                  role="menuitem"
                >
                  <Trash2 size={14} />
                  Delete
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

interface ComponentPreviewProps {
  template: ComponentTemplate;
  onInsert: (template: ComponentTemplate) => void;
}

const ComponentPreview = memo(function ComponentPreview({ template, onInsert }: ComponentPreviewProps) {
  const Icon = getComponentIcon(template.type);

  return (
    <button
      onClick={() => onInsert(template)}
      className="w-full border border-zinc-200 dark:border-zinc-700 rounded-lg p-3 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950 transition-all duration-150 text-left group focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 active:scale-[0.98]"
    >
      {/* Preview thumbnail */}
      <div className="w-full h-24 bg-zinc-50 dark:bg-zinc-800 rounded mb-2 flex items-center justify-center border border-zinc-200 dark:border-zinc-700 overflow-hidden">
        <Icon
          size={40}
          className="text-zinc-400 dark:text-zinc-500 group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-colors duration-150"
          strokeWidth={1.5}
        />
      </div>

      {/* Name and description */}
      <div className="font-medium text-sm text-zinc-900 dark:text-zinc-100 mb-1">
        {template.name}
      </div>
      <div className="text-xs text-zinc-600 dark:text-zinc-400 line-clamp-2">
        {template.description}
      </div>

      {/* Metadata */}
      <div className="mt-2 flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-500">
        <span>{template.elements.length} elements</span>
        <span>•</span>
        <span>{template.width}×{template.height}</span>
      </div>
    </button>
  );
});

function getComponentIcon(type: ComponentType): LucideIcon {
  const icons: Record<ComponentType, LucideIcon> = {
    'table': Table2,
    'table-filters': Filter,
    'empty-state': CircleDashed,
    'confirmation-modal': AlertTriangle,
    'simple-form': FormInput,
    'action-footer': RectangleHorizontal,
    // Phase 1 - Core templates
    'button': RectangleHorizontal, // Horizontal rectangle is more button-like
    'text-input': Type, // Type icon for text input
    'dropdown': ChevronDown, // Down chevron for dropdown
    'card': Square, // Square is appropriate for card
    'navigation-bar': RectangleHorizontal,
    'modal-dialog': AlertTriangle,
    'list-item': RectangleHorizontal,
    'header': RectangleHorizontal,
    'footer': RectangleHorizontal,
  };
  return icons[type] || Square;
}
