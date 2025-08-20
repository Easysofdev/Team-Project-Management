import React, { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

const Index = () => {
  const { user, signInDemo } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [demoLoading, setDemoLoading] = useState(false);

  useEffect(() => {
    if (user) {
      navigate("/dashboard");
    }
  }, [user, navigate]);

  const handleDemoLogin = async () => {
    setDemoLoading(true);
    try {
      const { error } = await signInDemo();
      if (error) {
        toast({
          title: "Demo Login Failed",
          description: "Please try again or contact support",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Welcome to Demo!",
          description:
            "You're now logged in with demo data. Feel free to explore!",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to login to demo account",
        variant: "destructive",
      });
    } finally {
      setDemoLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-6">
        <h1 className="text-4xl font-bold mb-4">Team Project Manager</h1>
        <p className="text-xl text-muted-foreground">
          Organize your projects with a simplified Trello-style board
        </p>
        <div className="space-x-4">
          <Button onClick={() => navigate("/auth")}>Get Started</Button>
          <Button variant="outline" onClick={() => navigate("/auth")}>
            Sign In
          </Button>
          <Button
            variant="secondary"
            onClick={handleDemoLogin}
            disabled={demoLoading}
          >
            {demoLoading ? "Loading..." : "Try Demo"}
          </Button>
        </div>
        <p className="text-sm text-muted-foreground mt-4">
          Demo account includes sample projects and tasks to explore the
          features
        </p>
      </div>
    </div>
  );
};

export default Index;
