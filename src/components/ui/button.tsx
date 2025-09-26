import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "primary-gradient text-primary-foreground shadow-soft hover:shadow-glow",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-soft",
        outline: "glass-card border-border hover:shadow-glow hover:border-primary/30",
        secondary: "premium-card hover:shadow-soft",
        ghost: "hover:glass-card hover:shadow-minimal",
        link: "text-primary underline-offset-4 hover:underline",
        premium: "primary-gradient text-primary-foreground shadow-glow hover:shadow-dramatic",
        minimal: "bg-transparent text-foreground hover:glass-card border border-border hover:border-primary/30",
        professional: "bg-foreground text-background hover:bg-foreground/90 shadow-soft",
      },
      size: {
        default: "h-12 px-6 py-3 rounded-xl",
        sm: "h-10 px-4 py-2 rounded-lg text-sm",
        lg: "h-14 px-8 py-4 rounded-xl text-base",
        xl: "h-16 px-12 py-5 rounded-2xl text-lg font-semibold",
        icon: "h-12 w-12 rounded-xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
