import { Component } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { AuthService } from '../core/auth.service';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent {
  form: FormGroup;
  loading = false;
  error: string | null = null;

  constructor(private fb: FormBuilder, private auth: AuthService, private router: Router) {
    // initialize form in constructor so FormBuilder is available
    this.form = this.fb.group({
      username: [''],
      password: ['']
    });
  }

  submit() {
    this.loading = true;
    this.error = null;

    const username = (this.form.value?.username ?? '') as string;
    const password = (this.form.value?.password ?? '') as string;

    this.auth.login(username, password).subscribe({
      next: () => {
        this.loading = false;
        // navigate home (or wherever you prefer)
        this.router.navigate(['/']);
      },
      error: (err) => {
        this.loading = false;
        // surface a helpful message
        this.error = err?.error?.detail || err?.error?.message || err?.message || 'Login failed';
      }
    });
  }
}