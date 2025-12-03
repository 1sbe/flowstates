from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

class MyTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Include additional claims in the access token so the frontend can decode
    username without an extra API call.
    """
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        # Add username and email (optional)
        token['username'] = user.get_username()
        # token['email'] = getattr(user, 'email', '')
        return token