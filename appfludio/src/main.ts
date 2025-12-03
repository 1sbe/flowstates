import { provideZoneChangeDetection } from "@angular/core";
import { bootstrapApplication } from '@angular/platform-browser';
import { importProvidersFrom } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { AppModule } from './app/app.module';



bootstrapApplication(App, {
  providers: [
    provideZoneChangeDetection(),provideHttpClient(),
    importProvidersFrom(AppModule)
  ]
})
  .catch((err) => console.error(err));
