import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ArtFluidComponent } from './art-fluid/art-fluid.component';
import { LoginComponent } from './auth/login.component';

const routes: Routes = [
  { path: '', component: ArtFluidComponent },
  { path: 'login', component: LoginComponent },
  // optional: saved-state editor/list routes
  // catch-all: redirect unknown URLs to home (safe for a single-page showcase)
  { path: '**', redirectTo: '' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { onSameUrlNavigation: 'reload' })],
  exports: [RouterModule]
})
export class AppRoutingModule {}