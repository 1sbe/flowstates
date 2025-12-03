from rest_framework.routers import DefaultRouter
from django.urls import path, include
from .views import SimStateViewSet

router = DefaultRouter()
router.register(r'simstates', SimStateViewSet, basename='simstate')

urlpatterns = [path('api/', include(router.urls))]