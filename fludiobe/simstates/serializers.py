from rest_framework import serializers
from .models import SimState

class SimStateSerializer(serializers.ModelSerializer):
    owner = serializers.ReadOnlyField(source='owner.username')

    class Meta:
        model = SimState
        fields = ['id', 'owner', 'name', 'payload', 'created_at', 'updated_at']

    def validate_payload(self, value):
        # simple validation: must be an object and small enough
        if not isinstance(value, dict):
            raise serializers.ValidationError("payload must be a JSON object")
        # optional: limit fields/size to avoid abuse
        # (for example)
        import json
        if len(json.dumps(value)) > 200000:  # ~200KB limit; tune as needed
            raise serializers.ValidationError("payload too large")
        return value