import * as React from 'react';

type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input: React.ForwardRefExoticComponent<InputProps & React.RefAttributes<HTMLInputElement>>;
