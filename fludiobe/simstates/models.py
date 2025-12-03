from django.db import models
from django.conf import settings

class SimState(models.Model):
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='simstates')
    name = models.CharField(max_length=200, blank=True)
    payload = models.JSONField()       # main simulator settings
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']

    def __str__(self):
        return f"{self.owner.username} - {self.name or self.pk}"