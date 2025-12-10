import { Component } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, AbstractControl } from '@angular/forms';
import { AuthService } from '../core/auth.service';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { finalize } from 'rxjs/operators';

function passwordMatchValidator(c: AbstractControl) {
  const p = c.get('password')?.value;
  const pc = c.get('passwordConfirm')?.value;
  return p === pc ? null : { passwordMismatch: true };
}

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent {
  // login form
  loginForm: FormGroup;
  // registration form
  registerForm: FormGroup;

  loading = false;
  error: string | null = null;

  // UI mode: false = login, true = create account
  createMode = false;

  constructor(private fb: FormBuilder, private auth: AuthService, private router: Router) {
    this.loginForm = this.fb.group({
      username: ['', Validators.required],
      password: ['', Validators.required]
    });

    this.registerForm = this.fb.group({
      username: ['', Validators.required],
      email: ['', [Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      passwordConfirm: ['', Validators.required]
    }, { validators: passwordMatchValidator });
  }

  submit() {
    if (this.loginForm.invalid) {
      this.error = 'Please provide username and password.';
      return;
    }
    this.loading = true;
    this.error = null;

    const username = this.loginForm.value.username;
    const password = this.loginForm.value.password;

    this.auth.login(username, password).pipe(
      finalize(() => this.loading = false)
    ).subscribe({
      next: () => this.router.navigate(['/']),
      error: err => {
        this.error = err?.error?.detail || err?.error?.message || err?.message || 'Login failed';
      }
    });
  }

  toggleCreate() {
    this.createMode = !this.createMode;
    this.error = null;
  }

  createAccount() {
    if (this.registerForm.invalid) {
      // Use hasError which is the correct typed API, or access errors via index if you must:
      // this.registerForm.errors?.['passwordMismatch']
      if (this.registerForm.hasError('passwordMismatch')) {
        this.error = 'Passwords do not match.';
      } else {
        this.error = 'Please fix registration errors.';
      }
      return;
    }

    this.loading = true;
    this.error = null;

    const { username, password, email } = this.registerForm.value;

    // call register endpoint
    this.auth.register(username, password, email).pipe(
      finalize(() => this.loading = false)
    ).subscribe({
      next: _res => {
        // Option A: auto-login after successful registration
        this.auth.login(username, password).subscribe({
          next: () => this.router.navigate(['/']),
          error: () => {
            // registration succeeded but auto-login failed; navigate to login and show message
            this.createMode = false;
            this.error = 'Account created. Please log in.';
          }
        });
      },
      error: err => {
        this.error = err?.error?.detail || err?.error?.message || err?.message || 'Registration failed';
      }
    });
  }
}