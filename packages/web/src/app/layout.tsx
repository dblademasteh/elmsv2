import "@radix-ui/themes/styles.css";
import "@/app/globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/theme-provider";

export const metadata = {
  title: "Learn. | Online Learning Platform",
  description: "Learn anything from expert instructors. Join thousands of learners transforming their careers.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-background text-foreground min-h-screen">
        <ThemeProvider>
          <main>{children}</main>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
