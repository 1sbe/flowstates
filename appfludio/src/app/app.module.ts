import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { AppRoutingModule } from './app-routing.module';
import { App } from './app';
import { ArtFluidComponent } from './art-fluid/art-fluid.component';
import { LoginComponent } from './auth/login.component';
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';
import { ReactiveFormsModule } from '@angular/forms';
import { ApiInterceptor } from './core/api.interceptor';

@NgModule({
  imports: [
    BrowserModule,
    AppRoutingModule,
    HttpClientModule,
    ReactiveFormsModule,

    // keep standalone components in imports if they are standalone
    App,
    ArtFluidComponent,
    LoginComponent
  ],
  providers: [
    { provide: HTTP_INTERCEPTORS, useClass: ApiInterceptor, multi: true }
  ]
  // NOTE: no 'bootstrap' array here because App is standalone - main.ts bootstraps it
})
export class AppModule {}