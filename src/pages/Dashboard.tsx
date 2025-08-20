import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FolderKanban, Plus, BarChart3, CheckCircle } from "lucide-react";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface DashboardStats {
  totalProjects: number;
  activeTasks: number;
  completedTasks: number;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [stats, setStats] = useState<DashboardStats>({
    totalProjects: 0,
    activeTasks: 0,
    completedTasks: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchDashboardStats();
    }
  }, [user]);

  const fetchDashboardStats = async () => {
    try {
      // First, get user's projects
      const { data: projects, error: projectsError } = await supabase
        .from("projects")
        .select("id")
        .eq("user_id", user?.id);

      if (projectsError) throw projectsError;

      const projectIds = projects?.map((p) => p.id) || [];

      // Then get tasks for those projects
      let activeTasks = 0;
      let completedTasks = 0;

      if (projectIds.length > 0) {
        const { data: tasksData, error: tasksError } = await supabase
          .from("tasks")
          .select("status")
          .in("project_id", projectIds);

        if (tasksError) throw tasksError;

        activeTasks =
          tasksData?.filter((task) => task.status === "in_progress").length ||
          0;
        completedTasks =
          tasksData?.filter((task) => task.status === "done").length || 0;
      }

      setStats({
        totalProjects: projectIds.length,
        activeTasks,
        completedTasks,
      });
    } catch (error) {
      console.error("Dashboard stats error:", error);
      toast({
        title: "Error",
        description: "Failed to fetch dashboard statistics",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome to your Team Project Manager
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Projects
              </CardTitle>
              <FolderKanban className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {loading ? "..." : stats.totalProjects}
              </div>
              <p className="text-xs text-muted-foreground">
                {stats.totalProjects === 0
                  ? "Start by creating your first project"
                  : `${stats.totalProjects} project${
                      stats.totalProjects === 1 ? "" : "s"
                    } created`}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Active Tasks
              </CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {loading ? "..." : stats.activeTasks}
              </div>
              <p className="text-xs text-muted-foreground">Tasks in progress</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Completed Tasks
              </CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {loading ? "..." : stats.completedTasks}
              </div>
              <p className="text-xs text-muted-foreground">Tasks completed</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              className="w-full justify-start"
              onClick={() => navigate("/projects")}
            >
              <FolderKanban className="h-4 w-4 mr-2" />
              View All Projects
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => navigate("/projects")}
            >
              <Plus className="h-4 w-4 mr-2" />
              Create New Project
            </Button>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Dashboard;
