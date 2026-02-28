import { useState, useEffect } from 'react';
import { Task } from '@/db/schema';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { User, Clock } from 'lucide-react';
import { MarkdownPreview } from './markdown-preview';

interface TaskDialogProps {
  task: Task;
  features?: unknown[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRefresh: () => void;
}

export function TaskDialog({ task, open, onOpenChange, onRefresh }: TaskDialogProps) {
  const [title, setTitle] = useState(task.title);
  const [priority, setPriority] = useState(task.priority);
  const [status, setStatus] = useState(task.status);
  const [body, setBody] = useState(task.body);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch fresh task data every time the dialog opens to get latest body from agent check_out
  useEffect(() => {
    if (!open) return;
    fetch(`/api/tasks/${task.id}`)
      .then((r) => r.json())
      .then((fresh: Task) => {
        setTitle(fresh.title);
        setPriority(fresh.priority);
        setStatus(fresh.status);
        setBody(fresh.body);
      })
      .catch(() => {
        // fall back to prop values
        setTitle(task.title);
        setPriority(task.priority);
        setStatus(task.status);
        setBody(task.body);
      });
  }, [open, task.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSave() {
    setIsSaving(true);
    try {
      await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, priority, status }),
      });
      onRefresh();
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to update task:', error);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1.5rem)] sm:w-[calc(100vw-3rem)] lg:w-[calc(100vw-6rem)] max-w-4xl xl:max-w-5xl max-h-[92vh] p-0 overflow-hidden flex flex-col">
        <DialogHeader className="px-6 pt-6 pb-3 pr-14 border-b-3 border-black shrink-0">
          <DialogTitle>Edit Task</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="space-y-5">
            {/* Title */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wide mb-2 block">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-3 border-3 border-black font-bold focus:outline-none focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                placeholder="Task title"
              />
            </div>

            {/* Priority & Status Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wide mb-2 block">
                  Priority
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full px-4 py-3 border-3 border-black font-bold uppercase focus:outline-none focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wide mb-2 block">
                  Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full px-4 py-3 border-3 border-black font-bold uppercase focus:outline-none focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                >
                  <option value="backlog">Backlog</option>
                  <option value="todo">To Do</option>
                  <option value="in_progress">In Progress</option>
                  <option value="interrupted">Interrupted</option>
                  <option value="done">Done</option>
                </select>
              </div>
            </div>

            {/* Spec Name */}
            {task.specName && (
              <div>
                <label className="text-xs font-bold uppercase tracking-wide mb-2 block">Spec</label>
                <div className="px-4 py-2 border-2 border-black bg-gray-50 font-mono text-sm">
                  {task.specName}
                </div>
              </div>
            )}

            {/* Task Card (read-only body) */}
            {body && (
              <div>
                <label className="text-xs font-bold uppercase tracking-wide mb-2 block">
                  Task Card
                </label>
                <div className="w-full px-4 py-3 border-2 border-black bg-gray-50 min-h-[100px] text-sm overflow-auto max-h-[40vh]">
                  <MarkdownPreview content={body} />
                </div>
              </div>
            )}

            {/* Metadata */}
            <div className="flex flex-wrap gap-3 pt-4 border-t-3 border-black">
              {task.assignedAgent && (
                <Badge variant="secondary" className="gap-1">
                  <User className="h-3 w-3" />
                  {task.assignedAgent}
                </Badge>
              )}
              <Badge variant="outline" className="gap-1">
                <Clock className="h-3 w-3" />
                Created: {new Date(task.createdAt).toLocaleDateString()}
              </Badge>
              {task.updatedAt && task.updatedAt !== task.createdAt && (
                <Badge variant="outline" className="gap-1">
                  <Clock className="h-3 w-3" />
                  Updated: {new Date(task.updatedAt).toLocaleDateString()}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t-3 border-black bg-white shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
