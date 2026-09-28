import { CandidateResponse } from "./candidate";

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  user: any;
  token: string;

  id: number;      
  email: string;       
  firstName: string;   
  lastName: string;    
  role: string;   

}