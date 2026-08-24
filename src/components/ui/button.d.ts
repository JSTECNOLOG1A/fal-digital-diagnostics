import * as React from 'react';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'; size?: 'default' | 'sm' | 'lg' | 'icon'; asChild?: boolean; };

export const Button: React.ForwardRefExoticComponent<ButtonProps & React.RefAttributes<any>>;
export const buttonVariants: (...args: any[]) => any;
