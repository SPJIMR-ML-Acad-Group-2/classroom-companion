import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, BookOpen } from "lucide-react";

export default function ManageCourses() {
    const navigate = useNavigate();
    return (
        <div className="min-h-screen bg-background">
            <header className="sticky top-0 z-50 border-b bg-card/80 backdrop-blur-sm">
                <div className="container flex h-16 items-center gap-4">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate("/dashboard")}
                        className="gap-2 text-muted-foreground"
                    >
                        <ArrowLeft className="h-4 w-4" /> Dashboard
                    </Button>
                    <div className="h-4 w-px bg-border" />
                    <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10">
                            <BookOpen className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                            <p className="text-sm font-semibold leading-none">Manage Courses</p>
                            <p className="text-xs text-muted-foreground mt-0.5">Configure courses and schedules</p>
                        </div>
                    </div>
                </div>
            </header>
            <main className="container py-16 flex justify-center">
                <Card className="max-w-md w-full">
                    <CardContent className="py-16 text-center space-y-3">
                        <BookOpen className="h-10 w-10 mx-auto text-muted-foreground" />
                        <p className="font-semibold">Coming Soon</p>
                        <p className="text-sm text-muted-foreground">
                            Course management is being built. Check back soon.
                        </p>
                    </CardContent>
                </Card>
            </main>
        </div>
    );
}
