from django.contrib import admin
from .models import SimState

@admin.register(SimState)
class SimStateAdmin(admin.ModelAdmin):
    list_display = ('id', 'owner', 'name', 'updated_at')
    search_fields = ('name','owner__username')