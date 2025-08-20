import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Plus, MoreHorizontal, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Layout } from "@/components/Layout";
import {
  DndContext,
  DragEndEvent,
  useDroppable,
  useDraggable,
  closestCenter,
} from "@dnd-kit/core";

interface Project {
  id: string;
  name: string;
  description?: string;
}

interface Task {
  id: string;
  title: string;
  description?: string;
  status: "todo" | "in_progress" | "done";
  created_at: string;
}

const statusColumns = [
  { key: "todo", title: "To Do", color: "bg-slate-100" },
  { key: "in_progress", title: "In Progress", color: "bg-yellow-100" },
  { key: "done", title: "Done", color: "bg-green-100" },
] as const;

const ProjectDetail = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<
    "todo" | "in_progress" | "done"
  >("todo");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (projectId && user) {
      fetchProjectAndTasks();
      const cleanup = setupRealtimeSubscription();
      return () => cleanup && cleanup();
    }
  }, [projectId, user]);

  const fetchProjectAndTasks = async () => {
    try {
      // Fetch project
      const { data: projectData, error: projectError } = await supabase
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .eq("user_id", user?.id)
        .single();

      if (projectError) throw projectError;
      if (!projectData) {
        navigate("/projects");
        return;
      }
      setProject(projectData);

      // Fetch tasks
      const { data: tasksData, error: tasksError } = await supabase
        .from("tasks")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

      if (tasksError) throw tasksError;
      setTasks(tasksData || []);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch project data",
        variant: "destructive",
      });
      navigate("/projects");
    } finally {
      setLoading(false);
    }
  };

  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel("tasks-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tasks",
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setTasks((prev) => [payload.new as Task, ...prev]);
          } else if (payload.eventType === "UPDATE") {
            setTasks((prev) =>
              prev.map((task) =>
                task.id === payload.new.id ? (payload.new as Task) : task
              )
            );
          } else if (payload.eventType === "DELETE") {
            setTasks((prev) =>
              prev.filter((task) => task.id !== payload.old.id)
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const createTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;

    setCreating(true);
    try {
      const { error } = await supabase.from("tasks").insert([
          {
            title: taskTitle.trim(),
            description: taskDescription.trim() || null,
            status: selectedStatus,
            project_id: projectId,
        },
        ]);

      if (error) throw error;

      setTaskTitle("");
      setTaskDescription("");
      setIsDialogOpen(false);
      
      toast({
        title: "Success",
        description: "Task created successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create task",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const updateTaskStatus = async (
    taskId: string,
    newStatus: "todo" | "in_progress" | "done"
  ) => {
    try {
      const { error } = await supabase
        .from("tasks")
        .update({ status: newStatus })
        .eq("id", taskId);

      if (error) throw error;
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update task",
        variant: "destructive",
      });
    }
  };

  const deleteTask = async (taskId: string) => {
    try {
      const { error } = await supabase.from("tasks").delete().eq("id", taskId);

      if (error) throw error;
      
      toast({
        title: "Success",
        description: "Task deleted successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete task",
        variant: "destructive",
      });
    }
  };

  const getTasksByStatus = (status: string) => {
    return tasks.filter((task) => task.status === status);
  };

  const onDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const taskId = String(active.id);
    const destinationStatus = over.id as "todo" | "in_progress" | "done";
    const draggedTask = tasks.find((t) => t.id === taskId);
    if (!draggedTask) return;
    if (draggedTask.status === destinationStatus) return;
    await updateTaskStatus(taskId, destinationStatus);
  };

  const DroppableColumn = ({
    id,
    children,
  }: {
    id: "todo" | "in_progress" | "done";
    children: React.ReactNode;
  }) => {
    const { setNodeRef, isOver } = useDroppable({ id });
    return (
      <div
        ref={setNodeRef}
        className={
          "space-y-3 min-h-[120px] p-1 rounded-md " +
          (isOver ? "ring-2 ring-primary/50" : "")
        }
      >
        {children}
      </div>
    );
  };

  const DraggableTask = ({ task }: { task: Task }) => {
    const { attributes, listeners, setNodeRef, transform, isDragging } =
      useDraggable({ id: task.id });
    const style: React.CSSProperties = {
      transform: transform
        ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
        : undefined,
      opacity: isDragging ? 0.6 : 1,
      cursor: "grab",
    };

    return (
      <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <div className="flex justify-between items-start">
              <CardTitle className="text-sm font-medium">
                {task.title}
              </CardTitle>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                    <MoreHorizontal className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {statusColumns.map((status) => (
                    <DropdownMenuItem
                      key={status.key}
                      onClick={() => updateTaskStatus(task.id, status.key)}
                      disabled={task.status === status.key}
                    >
                      Move to {status.title}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuItem
                    onClick={() => deleteTask(task.id)}
                    className="text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardHeader>
          {task.description && (
            <CardContent className="pt-0">
              <p className="text-xs text-muted-foreground">
                {task.description}
              </p>
            </CardContent>
          )}
        </Card>
      </div>
    );
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Loading project...</div>
        </div>
      </Layout>
    );
  }

  if (!project) return null;

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">{project.name}</h1>
            {project.description && (
              <p className="text-muted-foreground mt-1">
                {project.description}
              </p>
            )}
          </div>
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Task
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Task</DialogTitle>
              </DialogHeader>
              <form onSubmit={createTask} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Task Title</Label>
                  <Input
                    id="title"
                    placeholder="Enter task title"
                    value={taskTitle}
                    onChange={(e) => setTaskTitle(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description (Optional)</Label>
                  <Textarea
                    id="description"
                    placeholder="Enter task description"
                    value={taskDescription}
                    onChange={(e) => setTaskDescription(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <select
                    id="status"
                    aria-label="Status"
                    value={selectedStatus}
                    onChange={(e) =>
                      setSelectedStatus(
                        e.target.value as "todo" | "in_progress" | "done"
                      )
                    }
                    className="w-full p-2 border border-input rounded-md bg-background"
                  >
                    {statusColumns.map((status) => (
                      <option key={status.key} value={status.key}>
                        {status.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex justify-end space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={creating}>
                    {creating ? "Creating..." : "Create Task"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <DndContext collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {statusColumns.map((column) => (
            <div key={column.key} className="space-y-4">
              <div className={`p-4 rounded-lg ${column.color}`}>
                <h3 className="font-semibold text-center">
                  {column.title} ({getTasksByStatus(column.key).length})
                </h3>
              </div>
                <DroppableColumn id={column.key}>
                {getTasksByStatus(column.key).map((task) => (
                    <DraggableTask key={task.id} task={task} />
                  ))}
                {getTasksByStatus(column.key).length === 0 && (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    No tasks in {column.title.toLowerCase()}
                  </div>
                )}
                </DroppableColumn>
            </div>
          ))}
        </div>
        </DndContext>
      </div>
    </Layout>
  );
};

export default ProjectDetail;
